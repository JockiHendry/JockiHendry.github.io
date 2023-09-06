---
layout: post
category: Network
title: Apa Itu Protokol Session Traversal Utilities for NAT (STUN)?
tags: [Protocol, Go, JavaScript]
---

Salah satu istilah yang sering saya jumpai saat membuat kode program yang berhubungan dengan WebRTC adalah STUN.  Session 
Traversal Utilities for NAT (STUN) adalah protokol yang didefinisikan di [RFC 5389](https://www.ietf.org/rfc/rfc5389.txt).
STUN membantu mempermudah komunikasi dengan perangkat yang berada dibalik NAT yang tidak dapat dihubungi secara langsung
dari IP publik.  Komponen STUN disebut sebagai STUN Agent yang terdiri atas STUN Client dan STUN Server.

### STUN Lewat Go

Sebagai latihan, saya akan membuat kode program Go yang berperan sebagai STUN Client dan mengirim pesan Binding Request ke
STUN Server publik milik Google di `stun.l.google.com`.  Biasanya port yang dipakai untuk STUN adalah `UDP/3478`, namun
STUN Server gratis tersebut menggunakan port `UDP/19302`.  Saya akan mulai dengan mendefinisikan struktur *packet* STUN seperti
pada kode program berikut ini:

```golang
type Message struct {
	Header     MessageHeader
	Attributes []MessageAttribute
}

type MessageHeader struct {
	MessageType   uint16
	MessageLength uint16
	MagicCookie   uint32
	TransactionId [3]uint32
}

type MessageAttribute struct {
	Type   uint16
	Length uint16
	Value  []byte
}

type MappedAddressAttribute struct {
	Family uint8
	Port   uint16
	IP     net.IP
}
```

`MessageHeader` adalah sebuah struktur statis yang terdiri atas 20 bytes pertama dari *packet* STUN.  Nilai `MessageType`
menunjukkan jenis pesan STUN yang diterima.  Pada kode program sederhana ini, saya hanya akan menggunakan jenis pesan `BindingRequest`
dan `BindingResponse`:

```golang
const (
    BindingRequestType            = 0x0001
    BindingResponseType           = 0x0101
)
```

Nilai `MessageLength` menunjukkan isi dari pesan STUN (kosong atau beberapa `MessageAttribute`) dalam jumlah *byte* tidak
termasuk 20 bytes pertama (untuk *header*).  Khusus untuk pesan `BindingRequest`, karena saya tidak perlu memakai
atribut, nilai dari `MessageLength` selalu `0`.

Nilai `MagicCookie` selalu berupa `0x2112A442`.  Nilai ini dapat dipakai untuk memeriksa apakah *packet* STUN yang diterima
adalah bener *packet* STUN atau bukan.

Nilai `TransactionId` adalah sebuah angka pengenal unik dalam ukuran 12 bytes (96 bit).  Pada saat mengirim pesan `BindingRequest`,
saya perlu mengisi nilai ini dengan sebuah nilai acak.  Pada saat menerima pesan `BindingResponse`, saya perlu membandingkan
nilai `TransactionId` yang dterima apakah sama dengan nilai `TranscationId` saat dikirim.  Ini untuk memastikan bahwa jawaban
yang diterima adalah jawaban untuk *request* yang saya berikan.

Untuk membuat sebuah pesan `BindingRequest`, saya dapat menggunakan kode program seperti berikut ini:

```golang
func NewBindingRequest() *Message {
	return &Message{
		Header: MessageHeader{
			MessageType:   BindingRequestType,
			MessageLength: 0,
			MagicCookie:   MagicCookie,
			TransactionId: [3]uint32{rand.Uint32(), rand.Uint32(), rand.Uint32()},
		},
		Attributes: nil,
	}
}
```

Saya kemudian dapat mengirim pesan ini ke STUN server melalui koneksi UDP seperti pada *packet* lainnya, misalnya dengan kode program
seperti berikut ini:

```golang
func SendStunMessage(netInterface string, stunServer string, message *Message) ([]byte, error) {
	ip, err := GetLocalIP(netInterface)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve local ip for interface %s: %w", netInterface, err)
	}
	localAddr, err := net.ResolveUDPAddr("udp4", ip.String()+":0")
	if err != nil {
		return nil, fmt.Errorf("failed to resolve local addr %s: %w", ip.String(), err)
	}
	remoteAddr, err := net.ResolveUDPAddr("udp4", stunServer)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve remote addr %s: %w", stunServer, err)
	}
	conn, err := net.DialUDP("udp4", localAddr, remoteAddr)
	if err != nil {
		return nil, fmt.Errorf("failed to dial udp: %w", err)
	}
	err = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	if err != nil {
		return nil, fmt.Errorf("failed to set read deadline: %w", err)
	}	
	defer conn.Close()
	_, err = conn.Write(message.GetBytes())
	if err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}
	response := make([]byte, 1280)
	_, err = conn.Read(response)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	return response, nil
}
```

Setelah mengirim *packet* STUN ke STUN Server, kode program di atas akan menunggu hingga maksimal 5 detik untuk mendapatkan
respon. STUN Server akan mengirim pesan `BindingResponse` yang berisi alamat NAT atau IP publik terakhir yang dilihat
oleh STUN server saat menerima pesan `BindingRequest`.  Karena respon yang diterima berada dalam bentuk `[]byte`, saya dapat
menggunakan kode program seperti berikut ini untuk menerjemahkannya menjadi sebuah struktur `Message`:

```golang
func NewBindingResponse(raw []byte) (*Message, error) {
	buf := bytes.NewReader(raw)
	messageHeader := MessageHeader{}
	err := binary.Read(buf, binary.BigEndian, &messageHeader)
	if err != nil {
		return nil, fmt.Errorf("failed to ready binary: %w", err)
	}
	if messageHeader.MagicCookie != MagicCookie {
		return nil, fmt.Errorf("invalid magic cookie %d", messageHeader.MagicCookie)
	}
	message := new(Message)
	message.Header = messageHeader
	for i := uint16(20); i < uint16(20)+messageHeader.MessageLength; {
		attribute := MessageAttribute{}
		attribute.Type = binary.BigEndian.Uint16(raw[i : i+2])
		i += 2
		attribute.Length = binary.BigEndian.Uint16(raw[i : i+2])
		i += 2
		attribute.Value = raw[i : i+attribute.Length]
		i += attribute.Length
		message.Attributes = append(message.Attributes, attribute)
	}
	return message, nil
}
```

Pada kode program di atas, saya perlu menggunakan *looping* `for` karena sebuah *packet* STUN dapat berisi lebih dari satu
`MessageAttribute` dimana masing-masing `MessageAttribute` memiliki ukuran yang bervariasi tergantung pada nilai `Length`-nya. Setiap
`MessageAttribute` memiliki nilai `MessageType` yang menunjukkan jenis atribut (dan juga mendefinisikan struktur nilai dari 
atribut tersebut).  Khusus untuk `BindingResponse`, saya perlu mendapatkan nilai dari atribut `MappedAddressAttribute` dengan
nilai `0x0001` atau `XorMappedAddressAttributeType` dengan nilai `0x0020`:

```golang
const (	
	MappedAddressAttributeType    = 0x0001
	XorMappedAddressAttributeType = 0x0020
)
```

Untuk mengubah nilai `MessageAttribute.Value` menjadi sebuah `MappedAddressAttribute`, saya dapat menggunakan kode program
seperti berikut ini:

```golang
func GetMappedAddressAttribute(attribute *MessageAttribute) *MappedAddressAttribute {
	if attribute.Value[0] != 0 {
		return nil
	}
	mappedAddressAttribute := new(MappedAddressAttribute)
	mappedAddressAttribute.Family = attribute.Value[1]
	mappedAddressAttribute.Port = binary.BigEndian.Uint16(attribute.Value[2:4])
	mappedAddressAttribute.IP = attribute.Value[4:]
	return mappedAddressAttribute
}
```

Untuk `MappedAddressAttribute`, byte pertama selalu kosong.  Saya dapat menggunakan fakta ini untuk memeriksa apakah atribut ini 
valid atau tidak.  Setelah itu, saya mulai dengan byte kedua yang berisi nilai untuk `Family`. Nilai `Family` berupa `0x01` 
menunjukkan bawah ini adalah alamat IPv4 dan `0x02` untuk alamat IPv6.  Berikutnya, byte ketiga dan keempat menjukkan nilai 
`Port`.  Sisanya adalah nilai alamat IP. Karena Go memiliki struktur `net.IP` untuk `[]byte`, saya menggunakan struktur
tersebut untuk nilai IP.

STUN server dari Google tidak mengembalikan atribut `MappedAddressAttribute` melainkan `XorMappedAddressAttribute`.  Jenis
atribut ini hampir sama dengan nilai `MappedAddressAttribute`, hanya saja nilai *port* dan IP disamarkan melalui operasi
XOR terhadap *magic cookie* dan *transaction id*.  Tujuan menyamarkan nilai tersebut adalah untuk mencegah perangkat jaringan 
tertentu dalam memproses NAT secara tidak sengaja menulis ulang IP dan *port* yang hanya berupa informasi di *packet* STUN.  

Untuk mendapatkan nilai `XorMappedAddressAttribute`, saya dapat menggunakan kode program seperti berikut ini:

```golang
func GetXorMappedAddressAttribute(attribute *MessageAttribute, xorOperand []byte) *MappedAddressAttribute {
	result := GetMappedAddressAttribute(attribute)
	result.Port ^= binary.BigEndian.Uint16(xorOperand[0:2])
	xorAssignment(result.IP, xorOperand)
	return result
}

func xorAssignment(a []byte, b []byte) {
	for i := 0; i < len(a); i++ {
		a[i] ^= b[i]
	}
}
```

Saya dapat memanggil *function* di atas dengan menyertakan nilai byte *magic cookie* hingga *transaction id* seperti berikut ini:

```golang
address = stun.GetXorMappedAddressAttribute(attribute, response[4:20])
fmt.Printf("Public IP Address is %s:%d\n", netInterface, address.IP.String(), address.Port)
```

Sampai disini, saya sudah berhasil mendapatkan IP publik melalui protokol STUN.

### STUN Lewat Web

Selain dengan pemograman *low level* melalui Go, saya juga dapat menghubungi STUN Server melalui JavaScript di web browser.  Hampir
semua browser modern mendukung WebRTC yang menggunakan protokol Interactive Connectivity Establishment (ICE).  Protokol ICE
menggunakan STUN di tahap *client negotiation*.  Dengan demikian, saya dapat memanfaatkan fase tersebut untuk mengetahui IP publik
dan menampilkannya di halaman web.  Sebagai contoh, saya dapat membuat kode program seperti berikut ini:

```javascript
const connection = new RTCPeerConnection({
    iceServers: [{
        urls: 'stun:stun.l.google.com:19302'
    }]
});
connection.createDataChannel('dummyChannel');
connection.createOffer()
    .then((offer) => connection.setLocalDescription(offer));
```

Kode program di atas akan melakukan *binding request* ke STUN Server `stun.l.google.com:19302` untuk setiap perangkat jaringan lokal yang
dijumpai oleh web browser.  Untuk mendapatkan informasi alamat IP publik, saya dapat menggunakan *event* `onicecandidate` seperti berikut ini:

```javascript
connection.onicecandidate = (event) => {
    if ((event == null) || (event.candidate == null) || (event.candidate.candidate === '')) {
        connection.close();
        return;
    }
    console.log(`${event.candidate.address}:${event.candidate.port}`);
};
```

Sebagai contoh, berikut ini adalah contoh hasil eksekusi JavaScript yang berusaha mendapatkan IP publik melalui WebRTC:

<pre id="ip-output">
</pre>

<script>
const output = document.getElementById("ip-output");
output.textContent = "Starting...\n";
const connection = new RTCPeerConnection({
    iceServers: [{
        urls: 'stun:stun.l.google.com:19302'
    }]
});
connection.createDataChannel('dummyChannel');
connection.createOffer()
    .then((offer) => connection.setLocalDescription(offer))
    .then(() => output.textContent += "Offer created...\n");
connection.onicecandidate = (event) => { 
    if ((event == null) || (event.candidate == null) || (event.candidate.candidate === '')) {
        output.textContent += 'Done.\n';
        connection.close();
        return;
    } 
    console.log(event.candidate);
    output.textContent += `Received address ${event.candidate.address}:${event.candidate.port}\n`;
};
</script>