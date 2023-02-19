---
layout: post
category: Pemograman
title: Memakai Algoritma HOTP & TOTP
tags: [Go]
---

Salah satu algoritma yang paling sering digunakan untuk menghasilkan *one-time password* (OTP) adalah algoritma *HMAC-based
one-time password* (HOTP) dan *Time-based one-time password* (TOTP).  Sebagai contoh, Google Authenticator mendukung kedua
algoritma tersebut dimana HOTP disebut sebagai *counter based* dan TOTP disebut sebagai *time based* seperti yang diperlihatkan pada
gambar berikut ini:

![Tampilan Google Authenticator]({{ "/assets/images/gambar_00096.png" | relative_url}}){:class="img-fluid rounded"}


#### Algoritma HOTP

Algoritma HOTP lebih sering dipakai pada token perangkat keras.  Algoritma ini bergantung pada nilai *counter* yang harus 
sama antara perangkat yang menghasilkan OTP dan *backend* yang melakukan validasi (biasanya tanpa komunikasi langsung). 

[RFC 4226](https://www.ietf.org/rfc/rfc4226.txt) mendefinisikan algoritma HOTP (HMAC-Based One-Time Password) sebagai:

```
HOTP(K,C) = Truncate(HMAC-SHA-1(K,C))
```

Agar lebih jelas, saya akan mencoba membuat kode program Go yang melakukan kalkulasi HOTP.  Saya akan mulai dengan menulis
kode program seperti berikut ini:

```golang
k := "OJQWQYLTNFQWU33DNNUSCIIK"
c := uint64(1)
b, _ := base32.StdEncoding.DecodeString(k)
hmacSha1 := hmac.New(sha1.New, b)
cb := make([]byte, 8)
binary.BigEndian.PutUint64(cb, c)
hmacSha1.Write(cb)
hash := hmacSha1.Sum(nil)
```

Pada kode program di atas, saya menggunakan *secret* `k` dengan nilai `"OJQWQYLTNFQWU33DNNUSCIIK"`.  Walaupun bukan bagian dari RFC 4226,
Google Authenticator menggunakan versi *base32 encoded* dari *secret* yang sesungguhnya.  Sebagai contoh, karena nilai *secret*
saya adalah `rahasiajocki!!`, saya bisa mendapatkan nilai *base32 encoded* dengan memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>echo 'rahasiajocki!!' | base32</code>

```
OJQWQYLTNFQWU33DNNUSCIIK
```

Hasil dari perintah di atas juga adalah nilai yang *valid* untuk dipakai sebagai *secret key* di Google Authenticator.

Nilai `c` yang saya pakai berupa `1`.  Sesuai spesifikasi RFC 4226, nilai ini bertipe 8 bytes (`uint64`).  Ini juga
merupakan nilai yang saya sertakan sebagai masukan untuk kalkulasi HMAC-SHA-1.  Hasil dari kalkulasi tersebut akan disimpan
di variabel `hash`.  Nilai `hash` selalu memiliki ukuran 160 bits (20 bytes).

Bagian berikutnya adalah melakukan konversi `hash` menjadi angka singkat yang mudah diketik oleh pengguna.  Sebagai contoh, untuk
menghasilkan 6 digit angka dari `hash`, saya melanjutkan kode program di atas dengan menambahkan bagian berikut ini:

```golang
offset := hash[19] & 0xf
```

Pada kode program di atas, saya melakukan *masking* dengan `0xf` untuk mendapatkan nilai `offset` dari *byte* paling terakhir dari `hash`.  Nilai ini
akan selalu berada dalam batasan `0` hingga `15`.  Setelah mendapatkan nilai `offset`, saya perlu mengambil nilai dari 4 *byte* `hash` mulai dari
posisi `offset` hingga `offset+3`.  Sebagai contoh, bila nilai `offset` adalah `3`, saya akan mengambil *byte* di posisi `3`, `4`, `5`, `6`.
Bila nilai `offset` adalah `15`, saya akan mengambil *byte* di posisi `15`, `16`, `17`, `18`.  Saya dapat melakukannya dengan menggunakan
kode program berikut ini:

```golang
binCode := []byte{hash[offset] & 0x7f, hash[offset+1], hash[offset+2], hash[offset+3]}
```

Saya melakukan *masking* nilai `hash[offset]` dengan `0x7f` karena pada spesifikasi RFC 4226, hanya 31 bit terakhir yang diambil.  Karena 4 bytes terdiri
atas 32 bit, saya perlu membuang bit pertama dari `hash[offset]`.  Setelah ini, saya menambahkan kode program ini untuk menerjemahkan `binCode` menjadi
sebuah angka 32 bit dan menggunakan modulus untuk mendapatkan angka 6 digit:

```golang
dbc := binary.BigEndian.Uint32(binCode)
print(dbc % uint32(math.Pow(10, 6)))
```

Kode program di atas akan mengembalikan nilai `231384` sebagai token yang perlu dimasukkan oleh pengguna.  Bila saya menggunakan Google Authenticator
untuk menambahkan *secret key* `OJQWQYLTNFQWU33DNNUSCIIK` dengan tipe **Counter based**, saat *counter* bernilai `1`, saya juga akan memperoleh nilai
`231384` yang sama.

Di HOTP, setiap kali saya meminta token baru, nilai *counter* akan ditingkatkan.  Validator di sisi server dan generator HOTP perlu memiliki
mekanisme untuk melakukan sinkronisasi *counter* (tanpa berkomunikasi secara langsung).  Bila terjadi perbedaan *counter* yang terlalu jauh,
token juga dapat dikunci untuk mencegah serangan *brute-force*.

#### Algoritma TOTP

Time-Based One-Time Password (TOTP) adalah pengembangan dari algoritma HOTP dimana penggunaan *counter* diganti menjadi waktu.  [RFC 6238](https://www.ietf.org/rfc/rfc6238.txt) mendeklarasikan
algoritma TOTP sebagai:

```
TOTP = HOTP(K, T)
```

Nilai `T` sendiri didefinisikan sebagai:

```
T = (Current Unix Time - T0) / X
```

dimana nilai `T0` adalah nilai awal dari Unix time yang masuk dalam perhitungan (*default*-nya adalah `0`) dan nilai `X` adalah
nilai *step* dalam detik (*default*-nya adalah 30 detik).

Dengan demikian, saya bisa menulis algoritma TOTP sebagai:

```golang
package main

import (
	"crypto/hmac"
	"encoding/base32"
	"encoding/binary"
	"math"
	"time"
)
import "crypto/sha1"

func hotp(k []byte, c uint64) uint32 {
	hmacSha1 := hmac.New(sha1.New, k)
	cb := make([]byte, 8)
	binary.BigEndian.PutUint64(cb, c)
	hmacSha1.Write(cb)
	hash := hmacSha1.Sum(nil)
	offset := hash[19] & 0xf
	binCode := []byte{hash[offset] & 0x7f, hash[offset+1], hash[offset+2], hash[offset+3]}
	dbc := binary.BigEndian.Uint32(binCode)
	return dbc % uint32(math.Pow(10, 6))
}

func totp(k []byte) uint32 {
	now := uint64(time.Now().Unix())
	t0 := uint64(0)
	x := uint64(30)
	t := (now - t0) / x
	return hotp(k, t)
}

func main() {
	k := "OJQWQYLTNFQWU33DNNUSCIIK"
	kb, _ := base32.StdEncoding.DecodeString(k)
	print(totp(kb))
}
```

Bila saya membandingkan hasil dari kode program di atas dengan nilai dari Google Authenticator, saya akan memperoleh
hasil yang sama, seperti yang diperlihatkan pada gambar berikut ini:

![Perbandingan Hasil Kode Program dan Google Authenticator]({{ "/assets/images/gambar_00097.png" | relative_url}}){:class="img-fluid rounded"}
keys