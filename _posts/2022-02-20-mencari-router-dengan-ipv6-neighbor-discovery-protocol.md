---
layout: post
category: Network
title: Mencari Router Dengan IPv6 Neighbor Discovery Protocol
tags: [Go, Protocol]
---

Seluruh perangkat yang terhubung ke jaringan yang sama secara langsung dapat berkomunikasi satu dengan lainnya.  Namun, untuk berkomunikasi dengan perangkat di segmen jaringan yang berbeda, perangkat harus melalui router terlebih dahulu.  Pada konfigurasi manual, pengguna bisa mengisi alamat IP router sebagai gateway.  Namun, hampir semua sistem operasi modern mendukung konfigurasi jaringan otomatis dimana perangkat bisa terhubung ke router tanpa harus tahu apa IP router tersebut.  Bagaimana cara kerjanya?

Di IPv4, RFC 1256 memiliki spesifikasi ICMP Router Discovery untuk keperluan ini.  Pada saat sebuah perangkat terhubung ke jaringan, ia akan mengirimkan pesan Router Solicitation ke alamat *multicast*.  Router yang menerima pesan ini akan mengirim pesan Router Advertisement sehingga perangkat tahu keberadaan router tersebut.  Selain itu, router juga secara periodik akan mengirimkan pesan Router Advertisement setiap 7 sampai 10 menit.

Untuk jaringan IPv6, protokol ini di-atur oleh RFC 1970 dengan nama Neighbor Discovery Protocol.  Selain Router Solicitation dan Router Advertisement yang hampir sama dengan RFC 1256, Neighbor Discovery Protocol juga memiliki jenis pesan lain seperti Neighbor Solicitation, Neighbor Advertisement, dan Redirect.  Karena memakai IPv6, saya akan mencoba menggunakan Neighbor Discovery Protocol.

Sebagai latihan, saya akan membuat sebuah kode program Go yang akan mengirimkan pesan Router Solicitation.  Bahasa pemograman Go tetap dapat menggunakan library C seperti `libpcap` untuk menerima dan mengirim pesan mentah di *network card*.  Apa yang dilakukan Go terhadap C hampir sama seperti apa yang dilakukan TypeScript pada JavaScript: mempermudah dan menyederhanakan namun tetap dapat memakai *dependency* yang sudah ada.  Saya akan menggunakan [gopacket](https://github.com/google/gopacket) sehingga tidak perlu mengakses `libpcap` secara langsung.  Untuk itu, saya akan memberikan perintah berikut ini:

> <strong>$</strong> <code>sudo apt-get install libpcap-dev</code>

> <strong>$</strong> <code>go mod init ndp</code>

> <strong>$</strong> <code>go get github.com/google/gopacket</code>

Perintah di atas akan men-*download* dan menulis *dependency* di file `go.mod`.  Saya kemudian dapat mulai menulis kode program di file `ndp.go` dengan isi seperti berikut ini:

```golang
package main

import (
	"flag"
	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"log"
	"net"
)

var iface = flag.String("i", "eth0", "Nama perangkat jaringan untuk dipakai")
var destinationIP = flag.String("t", "ff02::2", "IPv6 multicast tujuan")

func sendRouterSolicitation(handle *pcap.Handle) {
	ethernetLayer := &layers.Ethernet{
		SrcMAC: net.HardwareAddr{0xAA, 0xBB, 0xCC, 0xAA, 0xBB, 0xCC},
		DstMAC: net.HardwareAddr{0x33, 0x33, 0x00, 0x00, 0x00, 0x00},
		EthernetType: layers.EthernetTypeIPv6,
	}

	ipLayer := &layers.IPv6{
		SrcIP: net.IPv6zero,
		DstIP: net.ParseIP(*destinationIP),
		Version: 6,
		TrafficClass: 0,
		FlowLabel: 0,
		HopLimit: 255,
		NextHeader: layers.IPProtocolICMPv6,
	}
	icmpLayer := &layers.ICMPv6{
		TypeCode: layers.CreateICMPv6TypeCode(layers.ICMPv6TypeRouterSolicitation, 0),
	}
	if err := icmpLayer.SetNetworkLayerForChecksum(ipLayer); err != nil {
		log.Fatal("Gagal melakukan kalkulasi checksum: ", err)
	}
	buffer := gopacket.NewSerializeBuffer()
	options := gopacket.SerializeOptions{
		ComputeChecksums: true,
		FixLengths: true,
	}
	if err := gopacket.SerializeLayers(buffer, options, ethernetLayer, ipLayer, icmpLayer, gopacket.Payload([]byte{0,0,0,0})); err != nil {
		log.Fatal("Gagal mempersiapkan raw packet: ", err)
	}
	if err := handle.WritePacketData(buffer.Bytes()); err != nil {
		log.Fatal("Gagal menulis packet: ", err)
	}
}

func main() {
	flag.Parse()
	handle, err := pcap.OpenLive(*iface, 65536, true, pcap.BlockForever)
	if err != nil {
		log.Fatal("Gagal memakai perangkat jaringan: ", err)
	}
	defer handle.Close()
	sendRouterSolicitation(handle)
}
```

Untuk alamat IP sumber, saya menggunakan nilai `net.IPv6zero` yang mewakili alamat `::`.  Nilai ini adalah nilai yang valid untuk *packet* Router Solicitation.  Untuk alamat IP tujuan, saya menggunakan alamat *multicast* `ff02::2` yang akan ditujukan ke seluruh *router* di segmen jaringan yang sama.  Selain `ff02::2`, saya juga dapat mengirim ke alamat `ff02::1` yang mengirim *packet* ke seluruh perangkat di segmen jaringan yang sama.  Untuk nilai MAC kartu jaringan, saya melakukan *spoofing* ke nilai `AA:BB:CC:AA:BB:CC`.  Nilai ini dapat berupa apa saja.  Yang lebih penting adalah nilai MAC tujuan yang harus berada di-antara `33:33:00:00:00:00` hingga `33:33:FF:FF:FF:FF` sesuai dengan aturan dari IEEE.

Struktur *packet* ICMPv6 untuk Router Solicitation cukup sederhana.  Nilai `Type` harus berupa `133` dan nilai `Code` berupa `0`.  Nilai `ComputeChecksums` berupa `true` akan menyebabkan *checksum* dikalkulasi secara otomatis sehingga saya cukup menyertakan 4 bytes kosong untuk mewakili bagian *reserved* yang tidak dipakai (namun wajib ada).

Untuk menjalankan kode program di atas, saya dapat memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>go build</code>

> <strong>$</strong> <code>sudo ./ndp -i eth0</code>

Bila saya melihat aktifitas jaringan melalui Wireshark, saya akan menemukan pesan Router Solicitation di kirim ke alamat *multicast* `ff02::2`.  Selanjutnya, *router* akan memberikan respon berupa pesan Router Advertisement yang dikirim ke alamat *multicast* `ff02::1`.  Untuk membaca dan menampilkan pesan Router Advertisement, saya akan melakukan perubahan pada kode program Go yang saya buat sehingga terlihat seperti berikut ini:

```golang
...
func sendRouterSolicitation(handle *pcap.Handle) { ... }

func readRouterAdvertisement(handle *pcap.Handle) {
	src := gopacket.NewPacketSource(handle, layers.LayerTypeEthernet)
	for packet := range src.Packets() {
		ipLayer := packet.Layer(layers.LayerTypeIPv6)
		if ipLayer == nil {
			continue
		}
		ip := ipLayer.(*layers.IPv6)
		icmpLayer := packet.Layer(layers.LayerTypeICMPv6RouterAdvertisement)
		if icmpLayer == nil {
			continue
		}
		icmp := icmpLayer.(*layers.ICMPv6RouterAdvertisement)
		sourceAddress := "(unknown)"
		for _, option := range icmp.Options {
			if option.Type == layers.ICMPv6OptSourceAddress {
				sourceAddress = net.HardwareAddr(option.Data).String()
			}
		}
		log.Printf("Menemukan router di IP %v (MAC: %v)", ip.SrcIP.String(), sourceAddress)
	}
}

func main() {
	flag.Parse()
	handle, err := pcap.OpenLive(*iface, 65536, true, pcap.BlockForever)
	if err != nil {
		log.Fatal("Gagal memakai perangkat jaringan: ", err)
	}
	defer handle.Close()
	go readRouterAdvertisement(handle)
	for {
		sendRouterSolicitation(handle)
		time.Sleep(30 * time.Second)
	}
}

```

Pada saat kode program di atas dikerjakan, *goroutine* `readRouterAdvertisement()` akan dikerjakan pada sebuah *thread* tersendiri khusus untuk membaca pesan Router Advertisement.  Sementara itu, pada *thread* utama, sebuah *loop* tanpa batas akan menulis pesan Router Solicitation setiap 30 detik hingga program dibatalkan dengan Ctrl+C.

Isi `readRouterAdvertisement()` sendiri pada dasarnya adalah sebuah *loop* yang membaca nilai dari *channel* yang dikembalikan oleh `src.Packets()`.  *Channel* ini tidak akan pernah berakhir sampai program dibatalkan oleh pengguna.  Untuk membaca *layer* tertentu dari *packet*, saya menggunakan kode program seperti `packet.Layer(layers.LayerTypeIPv6)` atau `packet.Layer(layers.LayerTypeICMPv6RouterAdvertisement)`.  Saya kemudian dapat menggunakan *type assertions* seperti `icmpLayer.(*layers.ICMPv6RouterAdvertisement)` untuk mengkonversi nilai ke dalam tipe `ICMPv6RouterAdvertisement` yang memiliki struktur seperti:

```golang
// ICMPv6RouterAdvertisement is sent by routers in response to Solicitation.
type ICMPv6RouterAdvertisement struct {
	BaseLayer
	HopLimit       uint8
	Flags          uint8
	RouterLifetime uint16
	ReachableTime  uint32
	RetransTimer   uint32
	Options        ICMPv6Options
}

type ICMPv6Options []ICMPv6Option

// ICMPv6Option contains the type and data for a single option.
type ICMPv6Option struct {
	Type ICMPv6Opt
	Data []byte
}
```

Sekarang, bila saya menjalankan program, ia tidak akan berhenti hingga saya menekan tombol Ctrl+C seperti yang diperlihatkan pada hasil berikut ini:

> <strong>$</strong> <code>go build</code>

> <strong>$</strong> <code>sudo ./ndp -i eth0</code>

```
2022/02/21 07:00:00 Menemukan router di IP aaaa::bbbb:cccc:dddd:eeee (MAC: xx:xx:xx:xx:xx:xx)
2022/02/21 07:00:30 Menemukan router di IP aaaa::bbbb:cccc:dddd:eeee (MAC: xx:xx:xx:xx:xx:xx)
...
```