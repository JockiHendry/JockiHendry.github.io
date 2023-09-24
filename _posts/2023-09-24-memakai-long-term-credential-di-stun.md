---
layout: post
category: Network
title: Memakai Long-Term Credential Di STUN
tags: [Protocol, Go]
---

[RFC 5389](https://www.ietf.org/rfc/rfc5389.txt) mendefinisikan dua metode *authentication* untuk STUN: *short-term credential* dan 
*long-term credential*.  Metode *short-term credential* dipakai pada protokol seperti ICE sementara *long-term credential* merupakan
persyaratan untuk protokol TURN.  Pada tulisan kali ini, saya akan mencoba menggunakan *long-term credential* di STUN.

*Authentication* dengan menggunakan *long-term credential* yang umum dipakai di TURN biasanya dikaitkan pada 5-Tuple. Nilai 5-Tuple
terdiri atas kombinasi IP sumber, port sumber, IP tujuan, port tujuan, dan jenis protokol yang dipakai.  Selama menggunakan 5-Tuple
yang sama, nilai *nonce* yang dibutuhkan untuk *authentication* tidak akan berubah (selain saat *server* mengirim kesalahan `438 Stale Nonce` 
yang berarti *nonce* sudah kadualarsa).  Untuk itu, saya membuat *struct* seperti berikut ini:

```golang
type Tuple struct {
	LocalAddr  *net.UDPAddr
	RemoteAddr *net.UDPAddr
}
```

Saya kemudian menambahkan sebuah *function* di *struct* tersebut untuk mengirim pesan STUN seperti yang saya lakukan di di [artikel sebelumnya]({% capture apa_itu_protokol_stun_url %}{% post_url 2023-09-06-apa-itu-protokol-stun %}{% endcapture %}{{ apa_itu_protokol_stun_url | absolute_url | remove: '.html' }}):

```golang
func (tuple *Tuple) SendStunMessage(message *Message) ([]byte, error) {
	conn, err := net.DialUDP("udp4", tuple.LocalAddr, tuple.RemoteAddr)
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
	if tuple.LocalAddr.Port == 0 {
		tuple.LocalAddr, _ = net.ResolveUDPAddr("udp4", conn.LocalAddr().String())
	}
	return response, nil
}
```

Bagian yang paling sulit ditebak dari 5-Tuple adalah *port* sumber.  Nilai ini sebaiknya dinamis untuk menghindari konflik karena 
sistem operasi bisa menggunakan berbagai *port* lokal untuk keperluan aplikasi lain.  Untuk itu, saya bisa menggunakan nilai 
seperti `192.168.1.100:0`.  Nilai *port* `0` disini adalah kode bagi sistem operasi untuk memilih *port* apa saja yang bebas dan 
tidak dipakai.  Namun, setelah pilihan dibuat oleh sistem operasi, saya perlu mengingat nilai *port* yang dipilih karena 
*authentication* di STUN/TURN terikat pada 5-Tuple.  Oleh sebab itu, pada akhir *function* di atas, saya menulis kode program
seperti:

```golang
...
if tuple.LocalAddr.Port == 0 {
    tuple.LocalAddr, _ = net.ResolveUDPAddr("udp4", conn.LocalAddr().String())
}
...
```

*Long-term credential* membutuhkan nilai *user*, *password*, dan *realm*.  Selain itu, sebuah nilai *nonce* yang dikembalikan dari
sisi *server* juga perlu ikut di-simpan (sebagai *cookie*).  Untuk menyimpan nilai-nilai tersebut, saya bisa mendefinisikan 
sebuah *struct* seperti pada kode program berikut ini:

```golang
type LongTermCred struct {
	Username string
	Password string
	Realm    []byte
	Nonce    []byte
}
```

Sekarang, saya bisa mendefinisikan variabel dari `Tuple` dan `LongTermCred` seperti pada contoh kode program berikut ini:

```golang
tuple := new(stun.Tuple)
tuple.LocalAddr, _ = net.ResolveUDPAddr("udp4", "192.168.1.100:0")
tuple.RemoteAddr, _ = net.ResolveUDPAddr("udp4", "10.20.30.40:3478")
cred := new(stun.LongTermCred)
cred.Username = "jocki"
cred.Password = "12345678"
```

Langkah paling awal dalam *authentication* di STUN adalah mengirim *packet* seperti biasa tanpa *credential*.  Bila *server* membutuhkan
*authentication*, saya akan memperoleh respon STUN yang mengandung atribut `ERROR-CODE` (`0x0009`).  Bukan hanya itu, *server* juga
akan mengembalikan atribute `NONCE` (`0x0015`) dan `REALM` (`0x0014`) seperti yang terlihat pada gambar berikut ini:

![Respon Untuk Paket Pertama]({{ "/assets/images/gambar_00109.png" | relative_url}}){:class="img-fluid rounded"}

Saya perlu memastikan bahwah jenis kesalahan di atribut `ERROR-CODE` adalah `0x0401` yang berarti `Unauthorized`.  Setelah yakin,
saya kemudian menyimpan nilai atribut `NONCE` dan `REALM` yang perlu saya pakai di *packet*-*packet* berikutnya hingga komunikasi 
selesai.  Untuk itu, saya bisa menulis kode program seperti berikut ini:

```golang
func SendWithAuth(tuple *Tuple, cred *LongTermCred, message *Message) (*Message, error) {	
	raw, err := tuple.SendStunMessage(message)
	if err != nil {
		return nil, fmt.Errorf("error sending authenticated message: %w", err)
	}
	stunResponse, err := NewStunResponse(raw)
	if err != nil {
		return nil, fmt.Errorf("error parsing authenticated message response: %w", err)
	}
	errorCodeAttribute := stunResponse.GetAttribute(0x0009)
	if errorCodeAttribute != nil && binary.BigEndian.Uint16(errorCodeAttribute.Value[2:4]) == 0x0401 {
		cred.storeCredential(stunResponse)		
	}
	return stunResponse, nil
}

func (cred *LongTermCred) storeCredential(stunResponse *Message) {
	realmAttribute := stunResponse.GetAttribute(0x0014)
	if realmAttribute != nil {
		cred.Realm = make([]byte, len(realmAttribute.Value))
		copy(cred.Realm, realmAttribute.Value)
	}
	nonceAttribute := stunResponse.GetAttribute(0x0015)
	if nonceAttribute != nil {
		cred.Nonce = make([]byte, nonceAttribute.Length)
		copy(cred.Nonce, nonceAttribute.Value[0:nonceAttribute.Length])
	}
}
```

Setelah pesan pertama ditolak dengan error `0x0401`, saya perlu mengirim ulang pesan tersebut:

```golang
func SendWithAuth(tuple *Tuple, cred *LongTermCred, message *Message) (*Message, error) {
	...
	if errorCodeAttribute != nil && binary.BigEndian.Uint16(errorCodeAttribute.Value[2:4]) == 0x0401 {
		cred.storeCredential(stunResponse)
		return SendWithAuth(tuple, cred, message)
	}
	....
}
```

Tentu saja bila saat pengiriman ulang, saya tidak melakukan apa-apa, pesan akan kembali ditolak dengan nilai `0x0401`.  Yang
perlu saya lakukan adalah menambahkan atribut `USERNAME` (`0x0006`), `REALM` (`0x0014`) dan `NONCE` (`0x0015`) pada pesan
STUN tersebut.  Karena seluruh nilai yang dibutuhkan sudah ada di `LongTermCred`, saya bisa menambahkan kode program seperti 
berikut ini:

```golang
func SendWithAuth(tuple *Tuple, cred *LongTermCred, message *Message) (*Message, error) {
	if cred.Nonce != nil && cred.Realm != nil {
		userAttribute := CreateMessageAttribute(0x0006, []byte(cred.Username))
		realmAttribute := CreateMessageAttribute(0x0014, cred.Realm)
		nonceAttribute := CreateMessageAttribute(0x0015, cred.Nonce)
		message.Attributes = append(message.Attributes, userAttribute, realmAttribute, nonceAttribute)
		message.Header.MessageLength += userAttribute.PaddedSize() + realmAttribute.PaddedSize() + nonceAttribute.PaddedSize()		
	}
    ...
}
```

Hal yang perlu saya perhatikan saat membuat atribut di pesan STUN adalah ukuran nilai atribut harus kelipatan 4 bytes (32-bit).
Bila tidak genap kelipatan 4, saya perlu menambahkan *padding* yang nilainya bisa berupa apa saja.  Sebagai contoh, nilai *username*
berupa `jocki` bukanlah kelipatan 4 bytes sehingga saya perlu menambahkan 3 bytes *padding* seperti `jocki000` agar menjadi 
kelipatan 4 bytes.  Secara kode program, saya dapat melakukannya dengan contoh seperti berikut ini:

```golang
func CreateMessageAttribute(attributeType uint16, value []byte) MessageAttribute {
	paddedSize := len(value)
	if paddedSize%4 != 0 {
		paddedSize += 4 - paddedSize%4
	}
	paddedValue := make([]byte, paddedSize)
	copy(paddedValue, value)
	return MessageAttribute{
		Type:   attributeType,
		Length: uint16(len(value)),
		Value:  paddedValue,
	}
}
```

Sebagai bagian paling terakhir dan yang paling penting, saya juga perlu menambahkan atribut `MESSAGE-INTEGRITY` (`0x0008`).  Nilai
ini merupakan nilai HMAC-SHA1 dari seluruh *packet* STUN tidak termasuk atribut `MESSAGE-INTEGRITY` tersebut.  Nilai *key* yang
dipakai untuk kalkulasi HMAC-SHA1 adalah kombinasi dari:

```
key = MD5(username ":" realm ":" password)
```

Salah hal penting yang perlu diperhatikan adalah *header* STUN mengandung informasi ukuran *packet* dalam *byte*.  Saat melakukan
kalkulkasi HMAC-SHA1, nilai ini harus sudah memperhitungkan atribut `MESSAGE-INTEGRITY` sebesar 24 bytes, walaupun atribut tersebut
tidak ikut serta dalam kalkulasi.

Untuk melakukan kalkulasi HMAC-SHA1, saya dapat menggunakan kode program seperti berikut ini:

```golang
func (stunMessage *Message) AddMessageIntegrity(key string) {
	stunMessage.Header.MessageLength += 24
	md5Hash := md5.New()
	_, err := io.WriteString(md5Hash, key)
	if err != nil {
		return
	}
	hmacHash := hmac.New(sha1.New, md5Hash.Sum(nil))
	hmacHash.Write(stunMessage.GetBytes())
	stunMessage.Attributes = append(stunMessage.Attributes, CreateMessageAttribute(0x0008, hmacHash.Sum(nil)))
}
```

Saya kemudian melakukan perubahan pada *function* `SendWithAuth` menjadi seperti berikut ini:

```golang
func SendWithAuth(tuple *Tuple, cred *LongTermCred, message *Message) (*Message, error) {
	if cred.Nonce != nil && cred.Realm != nil {
	    ...		
		message.AddMessageIntegrity(fmt.Sprintf("%s:%s:%s", cred.Username, cred.Realm, cred.Password))
	}
	...
	return stunResponse, nil
}
```

Setelah ini, bila *username* dan *password* yang saya pakai benar, saya tidak akan menemukan kesalahan `0x0401` saat
menerima respon dari *server* STUN.