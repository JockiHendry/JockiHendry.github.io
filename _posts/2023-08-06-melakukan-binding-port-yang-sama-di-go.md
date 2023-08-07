---
layout: post
category: Network
title: Melakukan Binding Port Yang Sama Di Go Dengan SO_REUSEPORT
tags: [Go]
---

Sebuah *socket* di sistem operasi berbasis UNIX adalah kombinasi dari alamat IP sumber, port sumber, alamat IP tujuan 
dan port tujuan.  Pada umumnya, bila sebuah program ingin membuat *socket* baru, kombinasi dari ke-empat elemen tersebut 
harus unik.  Untuk membuktikannya, saya akan membuat sebuah program yang melakukan *binding* di port `12345/UDP` dan pada
saat yang bersamaan, juga mengirim pesan dari port `12345/UDP` ke alamat multicast `239.255.255.259` di port `3702/UDP`. 
Contoh kode program Go-nya terlihat seperti berikut ini:

```golang
package main

import (
	"bytes"
	"log"
	"net"
	"strings"
	"sync"
)

func listen(wg *sync.WaitGroup, src *net.UDPAddr) {
	defer wg.Done()
	b := make([]byte, 1024)
	conn, err := net.ListenUDP("udp4", src)
	if err != nil {
		log.Fatal(err)
	}
	for {
		_, err = conn.Read(b)
		if err != nil {
			log.Fatal(err)
		}
		data := strings.TrimSpace(string(b[:bytes.IndexByte(b, 0)]))
		log.Println("Receiving: ", data)
		if data == "exit" {
			break
		}
	}
	err = conn.Close()
	if err != nil {
		log.Fatal(err)
	}
}

func send(wg *sync.WaitGroup, src *net.UDPAddr, dst *net.UDPAddr) {
	defer wg.Done()
	conn, err := net.DialUDP("udp4", src, dst)
	if err != nil {
		log.Fatal(err)
	}
	_, err = conn.Write([]byte("test_message"))
	if err != nil {
		log.Fatal(err)
	}
	err = conn.Close()
	if err != nil {
		log.Fatal(err)
	}
}

func main() {
	src, err := net.ResolveUDPAddr("udp4", "127.0.0.1:12345")
	if err != nil {
		log.Fatal(err)
	}
	dst, err := net.ResolveUDPAddr("udp4", "239.255.255.250:3702")
	if err != nil {
		log.Fatal(err)
	}
	wg := new(sync.WaitGroup)
	wg.Add(2)
	go listen(wg, src)
	go send(wg, src, dst)
	wg.Wait()
}
```

Pada kode program di atas, terdapat *goroutine* `listen()` yang menerima koneksi UDP masuk di port `12345` dan *goroutine* `send()` yang 
mengirim pesan UDP dari port `12345` ke port `3702` di alamat IP *multicast*.  Terlihat bahwa kedua *goroutine* tersebut menggunakan
port `12345` yang sama.  Apa yang terjadi saat program dijalankan?  Saya akan menemukan pesan kesalahan seperti berikut ini:

```
2023/08/06 00:00:00 listen udp4 127.0.0.1:12345: bind: address already in use
```

Untuk mengatasi pesan kesalahan di atas, pada sistem operasi Ubuntu, saya perlu menggunakan *flag* `SO_REUSEPORT` saat 
membuat *socket*. `SO_REUSEPORT` yang sudah ada sejak kernel Linux 3.9 memungkinkan sebuah aplikasi untuk menggunakan alamat IP 
dan *port* yang sama berulang kali.  Demi alasan keamanan, hal ini hanya bisa dilakukan bila *user id* (UID) program yang 
menggunakan `SO_REUSEPORT` sama dengan UID program yang sudah menggunakan *socket* tersebut lebih
awal.  Selain `SO_REUSEPORT`, juga ada pilihan `SO_REUSEADDR` yang lebih lama.  Berbeda dengan `SO_REUSEPORT`, `SO_REUSEADDR`
tidak memiliki mekanisme untuk mencegah terjadinya *port hijacking*.

Walaupun bagian dari fitur resmi Go, flag `SO_REUSEPORT` merupakan fitur eksperimental yang bersifat *low level* dan tidak
bisa jalan di sistem operasi sehingga ia diletakkan di *package* terpisah.  Untuk itu, saya perlu menambahkannya dengan
memberikan perintah seperti berikut ini:

><strong>$</strong> <code>go get golang.org/x/sys/unix</code>

Setelah itu, saya kemudian mengubah kode program saya sehingga terlihat seperti berikut ini:

```golang
package main

import (
	"bytes"
	"context"
	"golang.org/x/sys/unix"
	"log"
	"net"
	"strings"
	"sync"
	"syscall"
)

var listenConfig = net.ListenConfig{
	Control: func(network, address string, c syscall.RawConn) error {
		return c.Control(func(fd uintptr) {
			err := unix.SetsockoptInt(int(fd), unix.SOL_SOCKET, unix.SO_REUSEPORT, 1)
			if err != nil {
				log.Fatal(err)
			}
		})
	},
}

func listen(wg *sync.WaitGroup, src *net.UDPAddr) {
	defer wg.Done()
	b := make([]byte, 1024)
	conn, err := listenConfig.ListenPacket(context.Background(), "udp4", src.String())
	if err != nil {
		log.Fatal(err)
	}
	for {
		n, addr, err := conn.ReadFrom(b)
		if err != nil {
			log.Fatal(err)
		}
		data := strings.TrimSpace(string(b[:bytes.IndexByte(b, 0)]))
		log.Printf("Receiving %d bytes from %s => %s", n, addr, data)
		if data == "exit" {
			break
		}
	}
	err = conn.Close()
	if err != nil {
		log.Fatal(err)
	}
}

func send(wg *sync.WaitGroup, src *net.UDPAddr, dst *net.UDPAddr) {
	defer wg.Done()
	conn, err := listenConfig.ListenPacket(context.Background(), "udp4", "127.0.0.1:12345")	
	if err != nil {
		log.Fatal(err)
	}
	n, err := conn.WriteTo([]byte("test message"), dst)
	log.Println("Written ", n, " bytes")
	if err != nil {
		log.Fatal(err)
	}
	err = conn.Close()
	if err != nil {
		log.Fatal(err)
	}
}

func main() {
	src, err := net.ResolveUDPAddr("udp4", "127.0.0.1:12345")
	if err != nil {
		log.Fatal(err)
	}
	dst, err := net.ResolveUDPAddr("udp4", "239.255.255.250:3702")
	if err != nil {
		log.Fatal(err)
	}
	wg := new(sync.WaitGroup)
	wg.Add(2)
	go listen(wg, src)
	go send(wg, src, dst)
	wg.Wait()
}
```

Pada kode program di atas, saya membuat *instance* dari *structure* `ListenConfig`.  Saya dapat mendefinisikan kustomisasi 
pada *socket* yang dipakai melalui nilai `Control`.  Sebagai contoh, pada kode program di atas, saya memanggil
`unix.SetsockoptInt(int(fd), unix.SOL_SOCKET, unix.SO_REUSEPORT, 1)` untuk mengaktifkan *flag* `SO_REUSEPORT`.  Setelah itu,
saya dapat memanggil *method* `ListenPacket()` milik `ListenConfig` untuk mempersiapkan *socket* dan mendapatkan `PacketConn`.
Saya kemudian menggunakan *method* `ReadFrom()` untuk menerima pesan atau *method* `WriteTo()` untuk mengirim pesan. 

Saat kode program kembali dijalankan, saya tidak akan menemukan pesan kesalahan lagi.  Selain itu, saya dapat mencoba menjalankan
program tersebut lebih dari sekali pada saat bersamaan (misalnya di Terminal baru tanpa menutup program sebelumnya).  Walaupun 
dijalankan lebih dari sekali dan menggunakan *port* yang sama, program tetap akan bekerja seperti biasanya.