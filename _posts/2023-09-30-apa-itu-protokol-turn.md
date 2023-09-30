---
layout: post
category: Network
title: Apa Itu Protokol Traversal Using Relays around NAT (TURN)?
tags: [Protocol, Go]
---

Traversal Using Relays around NAT (TURN) adalah sebuah protokol *relay* yang memungkinkan *client* berkomunikasi dengan *peer* 
yang tidak memiliki IP publik secara langsung (misalnya berada dibalik NAT).  Protokol ini didefinisikan di [RFC 8656](https://www.ietf.org/rfc/rfc8656.txt).
Komponen TURN terdiri atas TURN client dan TURN server.  Komunikasi antara TURN client dengan *peer* selalu melalui TURN server yang berperan
sebagai perantara.  Oleh sebab itu, TURN server dan *peer* harus bisa saling berkomunikasi yang biasanya dilakukan
dengan meletakkan TURN server pada jaringan publik.  

Untuk struktur *packet*, TURN sendiri merupakan ekstensi dari STUN.  Struktur *packet* TURN tetap mengikuti struktur
*packet* STUN seperti yang saya tulis pada [artikel sebelumnya]({% capture apa_itu_protokol_stun_url %}{% post_url 2023-09-06-apa-itu-protokol-stun %}{% endcapture %}{{ apa_itu_protokol_stun_url | absolute_url | remove: '.html' }}).
Yang berbeda adalah TURN menambahkan beberapa operasi baru pada STUN seperti `Allocate`, `Refresh`, `Send`, `Data`,
`CreatePermission` dan `ChannelBind`.  Selain itu, TURN juga menambahkan atribut baru di STUN seperti `XOR-PEER-ADDRESS`,
`REQUESTED-TRANSPORT`, `DATA`, dan sebagainya.

Sebagai latihan, saya akan membuat aplikasi yang mengerjakan perintah terminal Linux secara jarak jauh dimana terdapat
dimana perintah yang sama yang diberikan pengguna akan dikerjakan oleh dua server Linux secara bersamaan.  Komponen aplikasi
latihan ini terdiri atas:

* Dua server Linux yang tidak dapat dihubungi dari Internet secara langsung karena berada di-balik NAT.  Mereka akan menerima
perintah dan mengembalikan hasil eksekusi perintah tersebut. 
* Sebuah server Linux yang memberikan perintah jarak jauh. Server ini berada di jaringan publik yang sama dengan TURN server.
* Sebuah TURN server siap pakai.  Saya memilih untuk menggunakan [coturn](https://github.com/coturn/coturn) pada latihan ini.

Arsitektur aplikasi latihan tersebut terlihat seperti pada gambar berikut ini:

![Arsitektur Percobaan]({{ "/assets/images/gambar_00108.png" | relative_url}}){:class="img-fluid rounded"}

Pada gambar di atas, saya menggunakan dua router berbeda untuk mensimulasikan Internet.  Perangkat `server1` dan `server2`
dapat menghubungi `TURN_server` dan `remote`, namun tidak berlaku sebaliknya.  Perangkat `remote` tidak bisa menghubungi langsung
`server1` dan `server2` yang berada di balik NAT.  Ini adalah metode perlindungan yang umum dipakai untuk melindungi perangkat
dari serangan publik.  Namun, berkat protokol TURN dan bantuan `TURN_server`, perangkat `remote` bisa melewati keterbatasan tersebut.

#### TURN Server

Untuk melakukan instalasi coturn, saya akan memberikan perintah:

> <strong>$</strong> <code>apt install coturn</code>

Setelah instalasi selesai, saya akan melakukan perubahan di `/etc/turnserver.conf`.  Saya akan  menambahkan *static credential* 
sehingga tidak semua orang bisa menggunakan TURN server ini:

```
user=turn:12345678
realm=latihan
```

*Authentication* melalui *long-term credential* seperti yang tulis pada [artikel sebelumnya]({% capture long_term_credential_url %}{% post_url 2023-09-24-memakai-long-term-credential-di-stun %}{% endcapture %}{{ long_term_credential_url | absolute_url | remove: '.html' }}) adalah persyaratan yang wajib
untuk menggunakan protokol TURN.  Agar perubahannya efektif, saya akan menjalankan ulang coturn dengan perintah:

> <strong>$</strong> <code>sudo systemctl restart coturn</code>

#### TURN Client

Seperti pada kode program di artikel-artikel sebelumnya, untuk mulai memakai protokol TURN, saya bisa menyiapkan struktur data 
yang dibutuhkan dengan menggunakan kode program seperti:

```golang
type TURNServerConnection struct {
	Connection           *net.UDPConn
	receivedMessageQueue chan *Message
}

func InitializeTURN(netInterface string) (*TURNServerConnection, error) {
	fmt.Println("Establishing network...")
	ip, err := GetLocalIP(netInterface)
	if err != nil {
		return nil, fmt.Errorf("failed to get local IP address: %w", err)
	}
	localAddr, err := net.ResolveUDPAddr("udp4", fmt.Sprintf("%s:0", ip.String()))
	if err != nil {
		return nil, fmt.Errorf("failed to resolve local address: %w", err)
	}
	remoteAddr, err := net.ResolveUDPAddr("udp4", "10.20.30.40:3478")
	if err != nil {
		return nil, fmt.Errorf("failed to resolve remote address: %w", err)
	}
	conn, err := net.DialUDP("udp4", localAddr, remoteAddr)
	if err != nil {
		return nil, fmt.Errorf("failed to establish connection to TURN server: %w", err)
	}
	turnServerConnection := new(TURNServerConnection)
	turnServerConnection.Connection = conn
	turnServerConnection.receivedMessageQueue = make(chan *Message, 100)
	return turnServerConnection, nil
}
```

Salah satu hal penting bagi TURN client adalah mempertahankan 5-Tuple yang sama sehingga tetap bisa menerima *packet* dari TURN server
setelah *UDP hole punching* di router. Oleh sebab itu, saya akan menggunakan sebuah `UDPConn` yang sama di seluruh komunikasi jaringan.  Selain itu, 
karena UDP yang bersifat *stateless*, saya menggunakan fitur *channel* di Go sebagai sebuah *buffer* FIFO untuk setiap *packet* STUN yang masuk.  Saya 
tidak bisa mengandalkan *packet* akan selalu dikirim dalam urutan yang sama persis sehingga saya perlu mencari *packet* yang 
diharapkan berdasarkan *transaction id* dengan kode program seperti berikut ini:

```golang
func (turnServerConnection *TURNServerConnection) WaitForReceivedMessage(transactionId [3]uint32, result chan *Message) {
	timeoutChannel := time.After(5 * time.Second)
	for {
		select {
		case m := <-turnServerConnection.receivedMessageQueue:
			if m.Header.TransactionId[0] == transactionId[0] &&
				m.Header.TransactionId[1] == transactionId[1] &&
				m.Header.TransactionId[2] == transactionId[2] {
				result <- m
				return
			} else {
				turnServerConnection.receivedMessageQueue <- m
			}
		case <-timeoutChannel:
			result <- nil
			return
		}
	}
}
```

Pada kode program di atas, saya menambahkan sebuah *channel* baru dengan nama `timeoutChannel` sehingga *function* di atas
hanya akan menunggu hingga maksimal 5 detik.  Hal ini karena pada protokol UDP, ada kemungkinan *packet* tidak akan pernah
sampai, sehingga saya tidak perlu terus menunggu.  Pada kode program untuk *production*, saya perlu menambahkan bagian
yang mengulangi pengiriman pesan bila hal ini terjadi.

Tentu saja kode program di atas tidak akan bekerja karena belum ada kode program yang mengirim data ke *channel* 
`turnServerConnection.receivedMessageQueue`.  Untuk itu, saya bisa membaca *packet* UDP dari `UDPConn` dengan kode program
seperti berikut ini:

```golang
func (turnServerConnection *TURNServerConnection) StartReceiving() {
	buffer := make([]byte, 65536)
	conn := turnServerConnection.Connection
	fmt.Printf("Listening on %s...\n", conn.LocalAddr())
	for {
		err := conn.SetDeadline(time.Now().Add(5 * time.Second))
		if err != nil {
			fmt.Printf("Failed to set deadline: %s\n", err)
			continue
		}
		_, _, err = conn.ReadFromUDP(buffer)
		if err != nil {
			continue
		}
		message, err := NewStunResponse(buffer)
		if err != nil {
			continue
		}
		fmt.Println("Received new STUN message.")
		turnServerConnection.receivedMessageQueue <- message
	}
}
```

Kode program di atas memiliki sebuah *for loop* tak terhingga yang akan terus menerus membaca *packet* yang masuk
dan mengirimkannya ke *channel* `turnServer.receivedMessageQueue` bila seandainya *packet* tersebut adalah *packet* STUN
yang valid.

Untuk mengirim *packet* STUN dan menunggu *packet* respon-nya (berdasarkan *transaction id*), saya dapat membuat kode
program seperti berikut ini:

```golang
func (turnServerConnection *TURNServerConnection) SendStunMessage(message *Message) (*Message, error) {
	err := turnServerConnection.SendStunMessageImmediately(message)
	if err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}
	ch := make(chan *Message, 1)
	go turnServerConnection.WaitForReceivedMessage(message.Header.TransactionId, ch)
	response := <-ch
	if response == nil {
		return nil, fmt.Errorf("failed to wait for response message: %w", err)
	}
	return response, nil
}

func (turnServerConnection *TURNServerConnection) SendStunMessageImmediately(message *Message) error {
	conn := turnServerConnection.Connection
	err := conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	if err != nil {
		return err
	}
	_, err = conn.Write(message.GetBytes())
	if err != nil {
		return err
	}
	return nil
}
```

Sekarang, setelah kode program untuk fasilitas STUN selesai dibuat, saya siap untuk menggunakan protokol TURN. Langkah pertama 
untuk memakai TURN adalah mengirim pesan `Allocate` (`0x003`) ke TURN server.  Pesan STUN ini wajib memiliki 
atribut `REQUESTED-TRANSPORT` (`0x0019`) yang berisi kode protokol yang hendak dipakai.  Saya akan menggunakan nilai `17`
untuk mewakili protokol UDP, seperti yang terlihat pada kode program berikut ini:

```golang
func NewAllocateRequest() *Message {
	return &Message{
		Header: MessageHeader{
			MessageType:   Allocate,
			MessageLength: 8,
			MagicCookie:   MagicCookie,
			TransactionId: [3]uint32{rand.Uint32(), rand.Uint32(), rand.Uint32()},
		},
		Attributes: []MessageAttribute{
			MessageAttribute{
				Type:   0x0019,
				Length: 4,
				Value:  []byte{17, 0, 0, 0},
			},
		},
	}
}
```

Bila TURN server berhasil melakukan alokasi alamat transportasi bagi TURN client ini, program akan mendapatkan respon
sukses.  *Packet* STUN untuk respon sukses harus memiliki atribut `XOR-RELAYED-ADDRESS`, `LIFETIME` dan `XOR-MAPPED-ADDRESS`.
Saya bisa membuat sebuah struktur baru untuk menampung hasil kembalian tersebut, seperti yang terlihat pada contoh
kode program berikut ini:

```golang
type TURNAllocation struct {
	RelayedAddress *MappedAddressAttribute
	ClientAddress  *MappedAddressAttribute
	Lifetime       uint32
}

func (allocation TURNAllocation) String() string {
	return fmt.Sprintf("relayed transport address = %s:%d, client address = %s:%d",
		allocation.RelayedAddress.IP.String(), allocation.RelayedAddress.Port,
		allocation.ClientAddress.IP.String(), allocation.ClientAddress.Port)
}

func (turnServerConnection *TURNServerConnection) Allocate(cred *LongTermCred) (*TURNAllocation, error) {
	fmt.Println("Sending allocation request...")
	message := NewAllocateRequest()
	response, err := SendWithAuth(turnServerConnection, cred, message)
	if err != nil {
		return nil, fmt.Errorf("error sending allocation request: %w", err)
	}
	fmt.Printf("Allocation has been completed!\n")
	allocation := new(TURNAllocation)
	allocation.RelayedAddress = GetXorMappedAddressAttribute(response.GetAttribute(0x0016), response.GetBytes()[4:20])
	allocation.ClientAddress = GetXorMappedAddressAttribute(response.GetAttribute(0x0020), response.GetBytes()[4:20])
	allocation.Lifetime = binary.BigEndian.Uint32(response.GetAttribute(0x000D).Value)
	return allocation, nil
}
```

Nilai dari `allocation.RelayedAddress` adalah alamat untuk *relayed transport address*. Pada arsitektur latihan ini, saya akan
mendapatkan nilai seperti `10.20.30.40:52726` dimana nilai *port*-nya akan acak tergantung pada apa 
yang diberikan oleh NAT server.  Bila *peer* ingin menghubungi *client* ini, ia hanya perlu mengirim pesan ke *relayed transport address*
tersebut (perhatikan bahwa IP-nya adalah IP NAT server).

Nilai `allocation.ClientAddress` adalah apa yang yang disebut sebagai *client reflexive transport address*.  Ini adalah IP 
yang berhubungan dengan TURN client bila dilihat dari sisi TURN server.  Walaupun TURN client memilik IP lokal `192.168.1.100`, 
nilai `allocation.ClientAddress` akan terlihat seperti `10.20.30.1:xxxx` karena yang dilihat oleh TURN server 
dan yang berhubungan langsung dengan TURN server adalah IP router `internet` di `10.20.30.1`.

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Spesifikasi RFC 8656 tidak mengatur bagaimana informasi <em>relayed transport address</em> harus dilewatkan
ke pihak lain yang akan memakainya.  Pada latihan sederhana ini, saya akan mengetikkan <em>relayed transport address</em> secara
manual.  Namun, pada aplikasi yang lebih kompleks, saya dapat menggunakan protokol lain seperti Interactive Connectivity
Establishment (ICE), REST API, dan sebagainya.
</div>

*Relayed transport address* yang diberikan oleh TURN server tidak bersifat permanen.  Ia hanya berlaku sesuai dengan nilai TTL 
yang tertera di atribut `LIFETIME`.  Bahkan bila *relayed transport address* tidak kadaluarsa, saya tetap perlu mengirim 
*packet* secara berkala agar NAT *binding* yang sudah ada tidak dihapus oleh router.  Agar bisa tetap menggunakan *relayed transport address* 
yang sama, saya perlu mengirim operasi `Refresh` (`0x004`) ke TURN server sebelum nilai TTL dicapai.  Untuk itu, saya bisa menggunakan
kode program seperti berikut ini:

```golang
func NewRefreshRequest() *Message {
	return &Message{
		Header: MessageHeader{
			MessageType:   Refresh,
			MessageLength: 8,
			MagicCookie:   MagicCookie,
			TransactionId: [3]uint32{rand.Uint32(), rand.Uint32(), rand.Uint32()},
		},
		Attributes: []MessageAttribute{
			{
				Type:   0x8000,
				Length: 4,
				Value:  []byte{1, 0, 0, 0},
			},
		},
	}
}
...
func (turnServerConnection *TURNServerConnection) Refresh(cred *LongTermCred) (*Message, error) {
	message := NewRefreshRequest()
	response, err := SendWithAuth(turnServerConnection, cred, message)
	if err != nil {
		return nil, fmt.Errorf("error while sending allocation refresh request: %w", err)
	}
	return response, nil
}
```

Satu-satunya atribut yang perlu saya berikan untuk operasi `Refresh` adalah `REQUESTED-ADDRESS-FAMILY` (`0x0017`).  Nilainya 
hanya bisa berupa `0x01` untuk alokasi IPv4 dan `0x02` untuk alokasi IPv6.  Bila proses *refresh* sukses, saya akan mendapatkan
*packet* STUN kembalian yang didalamnya berisi atribut `LIFETIME` yang baru.  Untuk mengerjakan `Refresh()` secara periodik,
misalnya saat 3/4 dari TTL sudah dicapai, saya dapat menggunakan kode program seperti berikut ini:

```golang
func (turnServerConnection *TURNServerConnection) RefreshAllocation(cred *LongTermCred, lifetime uint32) {
	for {
		time.Sleep(time.Duration(lifetime*3/4) * time.Second)
		fmt.Println("Refreshing allocation...")
		response, err := turnServerConnection.Refresh(cred)
		if err != nil {
			fmt.Printf("Error refreshing allocation: %s\n", err)
			return
		}
		lifetime = binary.BigEndian.Uint32(response.GetAttribute(0x000D).Value)
		fmt.Printf("Allocation refreshed. Timeout in %d seconds.\n", lifetime)
	}
}
```

Langkah berikutnya yang perlu saya lakukan adalah mengirim operasi `CreatePermission` (`0x008`) untuk mengizinkan perangkat
`remote` dengan IP `10.20.30.50` mengirim pesan melalui TURN server.  Operasi ini hanya membutuhkan atribut `XOR-PEER-ADDRESS`
(`0x0012`) yang berisi IP *peer* yang diizinkan.  Saya bisa membuat *packet* STUN untuk operasi ini dengan kode program
seperti berikut ini:

```golang
func NewCreatePermission(peerIP []byte) *Message {
	result := &Message{
		Header: MessageHeader{
			MessageType:   CreatePermission,
			MessageLength: 0,
			MagicCookie:   MagicCookie,
			TransactionId: [3]uint32{rand.Uint32(), rand.Uint32(), rand.Uint32()},
		},
	}
	result.Attributes = []MessageAttribute{
		CreateXorAddressAttribute(0x0012, peerIP, 0, result.GetBytes()[4:20]),
	}
	result.Header.MessageLength = uint16(len(result.GetBytes()) - 20)
	return result
}
```

Berdasarkan RFC 8656, *permission* akan kadaluarsa setelah 5 menit.  Saya perlu kembali mengirim operasi `CreatePermission` sebelum
batas waktu 5 menit ini tercapai.  Untuk itu, saya bisa menggunakan `time.Ticker` seperti pada kode program seperti berikut ini:

```golang
func (turnServerConnection *TURNServerConnection) AddPermission(cred *LongTermCred, ip []byte) {
	ticker := time.NewTicker(1 * time.Minute)
	action := func() {
		fmt.Println("Refreshing permission...")
		ipClone := make([]byte, 4)
		copy(ipClone, ip)
		message := NewCreatePermission(ipClone)
		_, err := SendWithAuth(turnServerConnection, cred, message)
		if err != nil {
			fmt.Printf("Error refreshing permission: %s\n", err)
			return
		}
		fmt.Println("Permission refreshed")
	}
	action()
	for {
		select {
		case <-ticker.C:
			action()
		}
	}
}
```

Sebagai bagian yang paling terakhir, saya kini siap untuk menerima *packet* TURN yang berisi `Data Indication` (`0x0017`).  Ini 
adalah *packet* yang akan diterima oleh TURN client bila *peer* mengirim pesan ke *relayed transport address*.  Pesan ini terdiri
atas 2 atribut: `XOR-PEER-ADDRESS` yang berisi *peer reflexive transport address* dan `DATA` yang berisi data yang dikirim oleh
*peer*.  Saya bisa menggunakan nilai atribut `XOR-PEER-ADDRESS` untuk mengirim respon ke *peer* yang bersangkutan.  Sebagai contoh,
saya dapat membuat kode program seperti berikut ini:

```golang
func (turnServerConnection *TURNServerConnection) ListenForData(handler func([]byte) []byte) {
	fmt.Println("Listening for incoming data...")
	for {
		select {
		case m := <-turnServerConnection.receivedMessageQueue:
			if m.Header.MessageType == 0x0017 {
				peerAddress := GetXorMappedAddressAttribute(m.GetAttribute(0x0012), m.GetBytes()[4:20])
				fmt.Printf("Received data indication from %s:%d...", peerAddress.IP.String(), peerAddress.Port)
				data := m.GetAttribute(0x0013).Value
				response := handler(data)
				sendIndicationResponse := NewSendIndication(peerAddress.IP, peerAddress.Port, response)
				err := turnServerConnection.SendStunMessageImmediately(sendIndicationResponse)
				if err != nil {
					fmt.Printf("Failed to send data response: %s\n", err)
				}
			} else {
				turnServerConnection.receivedMessageQueue <- m
			}
		}
	}
}
```

Pada kode program di atas, saya menjalankan *for loop* tanpa henti yang akan menunggu datangnya *packet* `Data Indication`.  Bila menemukannya,
ia akan melewatkan data yang diterima ke *function* `handler`.  Hasil kembalian dari *function* `handler` kemudian dipakai untuk
membuat *packet* `Send Indication` (`0x0016`).  Sama seperti `Data Indication`, pesan `Send Indication` hanya mengandung atribut `XOR-PEER-ADDRESS` 
dan `DATA` (tanpa *long term authentication*).  `Send Indication` digunakan agar TURN server dapat mengirim nilai yang tertera di atribut
`DATA` ke *peer* di alamat yang tertera di `XOR-PEER-ADDRESS`.  Untuk membuat *packet* STUN-nya, saya bisa menggunakan kode program
seperti berikut ini:

```golang
func NewSendIndication(targetIP []byte, targetPort uint16, data []byte) *Message {
	result := &Message{
		Header: MessageHeader{
			MessageType:   Send,
			MessageLength: 0,
			MagicCookie:   MagicCookie,
			TransactionId: [3]uint32{rand.Uint32(), rand.Uint32(), rand.Uint32()},
		},
	}
	result.Attributes = []MessageAttribute{
		CreateXorAddressAttribute(0x0012, targetIP, targetPort, result.GetBytes()[4:20]),
		CreateMessageAttribute(0x0013, data),
	}
	result.Header.MessageLength = uint16(len(result.GetBytes()) - 20)
	return result
}
```

Untuk implementasi *function* `handler`, saya bisa membuat sebuah *function* yang menerima perintah *shell*, mengerjakannya
melalui Bash dan mengembalikan *output* dari perintah tersebut seperti yang terlihat pada contoh kode program berikut ini:

```golang
func commandHandler(raw []byte) []byte {
	if len(raw) == 0 {
		return nil
	}
	command := string(raw)
	fmt.Printf("Executing command: %s\n", command)
	output, err := exec.Command("bash", "-c", command).Output()
	if err != nil {
		return []byte(err.Error())
	}
	return output
}
```

Struktur kode program utama saya akan terlihat seperti berikut ini:

```golang
func main() {
	fmt.Println("Welcome to TURN agent!")
	cred := new(stun.LongTermCred)
	cred.Username = "turn"
	cred.Password = "12345678"
	turnServerConnection, err := stun.InitializeTURN("ens5")
	if err != nil {
		fmt.Printf("Failed to initialize network: %s\n", err)
		return
	}
	go turnServerConnection.StartReceiving()
	allocation, err := turnServerConnection.Allocate(cred)
	if err != nil {
		fmt.Printf("Failed to allocate TURN relayed transport: %s\n", err)
		return
	}
	fmt.Printf("Allocation: %s\n", allocation)
	go turnServerConnection.RefreshAllocation(cred, allocation.Lifetime)
	go turnServerConnection.AddPermission(cred, []byte{10, 20, 30, 50})
	turnServerConnection.ListenForData(commandHandler)
}
```

Bila saya menjalankan program ini, saya akan memperoleh hasil seperti berikut ini:

```
Welcome to TURN agent!
Establishing network...
Sending allocation request...
Listening on 192.168.1.100:51484...
Received new STUN message.
Received new STUN message.
Allocation has been completed!
Allocation: relayed transport address = 10.20.30.40:59914, client address = 10.20.30.1:51484
Listening for incoming data...
Refreshing permission...
Received new STUN message.
Permission refreshed
```

Sampai disini, program sudah siap untuk menerima pesan dari *peer* yang berupa server `remote`.

#### Remote Peer

Pada arsitektur latihan ini, server `remote` dengan IP `10.20.30.50` berada di jaringan publik yang sama yang terhubung
ke TURN server di `10.20.30.40`.  Oleh sebab itu, saya tidak perlu membuat alokasi *relayed transport address* di TURN
server.  Saya dapat langsung menghubungi TURN server untuk mengirim pesan ke TURN client, misalnya dengan menggunakan `nc`
seperti yang terlihat pada perintah berikut ini:

> <strong>$</strong> <code>nc -u 10.20.30.40:59914 
```
whoami
tester
pwd
/home/tester/turn-tunnel/sources
```

Terlihat bahwa walaupun saya menghubungi alamat `10.20.30.40`, sebenarnya saya berkomunikasi dengan TURN client di 
alamat `192.168.1.100` yang sebelumnya tidak dapat saya hubungi dari publik.  Selain itu, bila dilihat dari sisi
TURN client di `192.168.1.100`, seluruh komunikasi hanya terjadi ke TURN server di `10.20.30.40` tanpa melibatkan
*peer* `remote` sama sekali di `10.20.30.50`, seperti yang diperlihatkan oleh hasil *capture* di Wireshark pada 
gambar berikut ini:

![Hasil Capture Di Sisi TURN client]({{ "/assets/images/gambar_00110.png" | relative_url}}){:class="img-fluid rounded"}

