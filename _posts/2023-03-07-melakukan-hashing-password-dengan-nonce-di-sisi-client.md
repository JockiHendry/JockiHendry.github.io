---
layout: post
category: Pemograman
title: Melakukan Hashing Password Dengan Nonce di Sisi Client
tags: [Go, JavaScript]
---

Proses *hashing* untuk password di sisi *frontend* biasanya dilakukan supaya password tidak dikirimkan apa adanya (*plain text*) melalui
jaringan.   Secara umum, proses ini tidak begitu meningkatkan keamanan password karena website modern sudah menggunakan HTTPS sehingga
 password yang dikirim ke *backend* sudah ter-enkripsi.  Proses *hashing* ini lebih berguna untuk serangan tertentu seperti MITM proxy dan 
mencegah password tidak sengaja tersimpan di log *backend* (misalnya di server NGINX yang men-*log* seluruh *request body*).

Salah satu kriteria penting agar *hashing* efektif adalah hasil *hash* harus dinamis.  Bila hasil *hash* selalu sama, 
nilai *hash* secara tidak langsung akan menjadi password.  Penyerang bisa dengan mudah menggunakan nilai *hash* untuk login
tanpa perlu tahu password yang sesungguhnya.  Oleh sebab itu, pendekatan yang menggunakan metode enkripsi/dekripsi dimana password yang sama 
akan menghasilkan hasil enkripsi yang sama, bukanlah solusi yang efektif.  Pada tulisan ini, saya akan mencoba menambahkan *nonce* pada proses
*hashing* untuk menghindary *replay attack*.

#### Kondisi Awal

Sebagai latihan, saya akan membuat sebuah *backend* dari Go dengan menggunakan framework Gin.  Ia akan menyediakan *endpoint* 
untuk proses login dengan kode program seperti berikut ini:

```golang
package main

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

const EMAIL = "admin@jocki.me"
const PASSWORD = "password_rahasia_saya"

type Login struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func main() {
	router := gin.Default()
	router.SetTrustedProxies(nil)
	router.LoadHTMLFiles("index.html")
	router.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", nil)
	})
	router.POST("/api/login", func(c *gin.Context) {
		var reqBody Login
		if err := c.BindJSON(&reqBody); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if reqBody.Email != EMAIL || reqBody.Password != PASSWORD {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
		})
	})
	router.Run()
}
```

Pada kode program Go di atas, *endpoint* `/api/login` akan menerima *request* JSON yang mengandung `email` dan `password`.  Ia kemudian
melakukan pemeriksaan untuk menentukan apakah email dan password-nya sesuai.  Selain itu, kode program di atas juga melayani file
statis `index.html`.  File ini akan mewakili *frontend* yang diakses langsung dari browser.  Sebagai latihan,
saya akan membuat file `index.html` dengan isi seperti berikut ini:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Latihan Hashing Password</title>
    <style>
        form {display: table}
        form div {display: table-row}
        label, input {display: table-cell; margin-bottom: 10px}
        label {padding-right: 10px}
        #output {white-space: pre; font-family: monospace; background-color: #eee; border: #aaa solid 1px; height: 300px; padding: 10px}
    </style>
</head>
<body>
    <h1>Login</h1>
    <div>
        <form id="form">
            <div>
                <label for="email">Email: </label>
                <input type="email" name="email" id="email" required/>
            </div>
            <div>
                <label for="password">Password: </label>
                <input type="password" name="password" id="password" required/>
            </div>
            <div>
                <input type="submit">
            </div>
        </form>
    </div>
    <div id="output"></div>
    <script>
        let form = document.getElementById('form');
        let output = document.getElementById('output');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            let email = document.getElementById('email').value;
            let password = document.getElementById('password').value;
            console.log(`Mengirim email [${email}] dan password [${password}] ke backend`);
            const response = await fetch(`${location.origin}/api/login`, {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password}),
            });
            output.textContent += response.statusText + '\n';
        });
    </script>
</body>
</html>
```

Halaman HTML di atas menggunakan JavaScript biasa tanpa *framework* (untuk dibuka dari browser modern).  Ia  menggunakan Fetch API untuk 
memanggil REST API yang disediakan *backend* Go sebelumnya.  Status hasil kembalian dari *backend* akan ditampilkan di halaman web 
seperti yang terlihat pada gambar berikut ini:

![Halaman Web Awal]({{ "/assets/images/gambar_00095.png" | relative_url}}){:class="img-fluid rounded"}

Pada contoh eksekusi di atas, terlihat bahwa nilai *password* dikirim apa adanya ke *backend*.  Salah satu potensi celah keamanan
disini adalah *password* tersebut tidak sengaja terekam di salah satu komponen *backend* seperti di log API gateway atau sejenisnya.
Bila seandainya *password* tidak pernah meninggalkan halaman HTML, maka tidak akan ada kebocoran kata sandi yang mungkin terjadi di sisi *backend*
(walaupun demikian, kebocoran dari sisi *frontend* seperti terekam di platform web *session replay* atau dibaca oleh *keylogger* di perangkat pengguna 
tetap bisa saja terjadi!).

#### Melakukan Hashing Password Dengan HMAC-SHA1

<div class="alert alert-warning" role="alert">
Teknik yang ditunjukkan pada bagian ini tidak untuk dipakai melainkan hanya dibuat untuk mengilustrasikan proses <em>hashing</em> yang tidak aman!  
</div>

Satu langkah untuk meningkatkan keamanan adalah dengan melakukan proses *hashing* pada kode program di bagian sebelumnya.  Sebagai contoh,
saya dapat menggunakan algoritma HMAC-SHA1 dengan sebuah *key* yang statis seperti pada kode program Go berikut ini:

```golang
package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"github.com/gin-gonic/gin"
	"net/http"
)

const EMAIL = "admin@jocki.me"
const PASSWORD = "password_rahasia_saya"
const STATIC_KEY = "sebuah_kunci_statis"

type Login struct {
	Email    string `json:"email" binding:"required"`
	Password []byte `json:"password" binding:"required"`
}

func hash(password []byte) []byte {
	hmacSha1 := hmac.New(sha1.New, []byte(STATIC_KEY))
	hmacSha1.Write(password)
	return hmacSha1.Sum(nil)
}

func isValidUser(email string, passwordHash []byte) bool {
	if email != EMAIL {
		return false
	}
	expectedHash := hash([]byte(PASSWORD))
	if !hmac.Equal(passwordHash, expectedHash) {
		return false
	}
	return true
}

func main() {
	router := gin.Default()
	router.SetTrustedProxies(nil)
	router.LoadHTMLFiles("index.html")
	router.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", nil)
	})
	router.POST("/api/login", func(c *gin.Context) {
		var reqBody Login
		if err := c.BindJSON(&reqBody); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if isValidUser(reqBody.Email, reqBody.Password) {
			c.JSON(http.StatusOK, gin.H{
				"status": "ok",
			})
			return
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
	})
	router.Run()
}
```

Pada kode program di atas, saya melakukan kalkulasi HMAC SHA1 dengan menggunakan sebuah `STATIC_KEY` dengan nilai `"sebuah-kunci-statis"`.  Agar
halaman web dapat menghasilkan kalkulasi HMAC SHA1 yang sama, saya juga perlu menggunakan nilai yang sama di halaman HTML, misalnya
seperti yang terlihat pada kode program berikut ini:

```javascript
let form = document.getElementById('form');
let output = document.getElementById('output');
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let email = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    let encoder = new TextEncoder();
    let key = await crypto.subtle.importKey('raw', encoder.encode('sebuah_kunci_statis'), {name: 'HMAC', hash: {name: 'SHA-1'}}, false, ['sign']);
    let hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(password)));
    console.log(`Mengirim email [${email}] dan password [${hash}] ke backend`);
    const response = await fetch(`${location.origin}/api/login`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password: Array.from(hash)}),
    });
    output.textContent += response.statusText + '\n';
});
```

Pada kode program JavaScript di atas, saya menggunakan `crypto.subtle` yang merupakan bagian dari Web Cryptography API dan didukung oleh
browser modern.  Saya menggunakan `importKey()` untuk menghasilkan sebuah *key* statis dengan nilai yang sama dengan yang saya pakai
di *backend*.  Saya kemudian melewatkan *key* tersebut di `sign()` untuk menghasilkan *hash* dari *password* yang kemudian dikirim ke *backend*
sebagai *array* di JSON *request body*.

Sebagai contoh, bila saya membuka halaman ini dan mengirim *password*, saya akan memperoleh hasil seperti yang terlihat pada gambar berikut ini:

![Hash Statis Dengan HMAC SHA1]({{ "/assets/images/gambar_00098.png" | relative_url}}){:class="img-fluid rounded"}

Walaupun *password* kini tidak terlihat lagi, teknik ini sama sekali tidak meningkatkan keamanan.  Hal ini disebabkan oleh hasil *hash* yang
selalu menghasilkan nilai yang sama (statis).  Penyerang yang berhasil melihat nilai *hash* tetap dapat mengirim *hash* tersebut kapan saja
untuk masuk ke dalam website!  Dengan kata lain, nilai *hash* perannya tidak jauh berbeda dari nilai *password* (yang perlu dilindungi).

#### Menambahkan Nonce Angka Pada Proses Hashing

Agar proses *hashing* aman, saya dapat menambahkan *nonce* yang berupa angka acak.  Dengan demikian, setiap *request* dengan *nonce* yang
berbeda akan menghasilkan *hash* yang berbeda namun tetap dapat diverifikasi oleh *backend*.  Sebagai contoh, saya akan mengubah kode
program Go yang ada menjadi seperti berikut ini:

```golang
package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/binary"
	"fmt"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"math/rand"
	"net/http"
	"strconv"
)

const EMAIL = "admin@jocki.me"
const PASSWORD = "password_rahasia_saya"

type Login struct {
	Email    string `json:"email" binding:"required"`
	Password []byte `json:"password" binding:"required"`
}

func hash(password []byte, nonce uint64) []byte {
	hmacSha1 := hmac.New(sha1.New, password)
	value := make([]byte, 8)
	binary.BigEndian.PutUint64(value, nonce)
	hmacSha1.Write(value)
	return hmacSha1.Sum(nil)
}

func isValidUser(email string, passwordHash []byte, nonce uint64) bool {
	if email != EMAIL {
		return false
	}
	expectedHash := hash([]byte(PASSWORD), nonce)
	if !hmac.Equal(passwordHash, expectedHash) {
		return false
	}
	return true
}

func generateNonce(s sessions.Session) uint64 {
	nonce := rand.Uint64()
	s.Set("nonce", nonce)
	s.Save()
	return nonce
}

func main() {
	router := gin.Default()
	store := cookie.NewStore([]byte("secret"))
	router.Use(sessions.Sessions("session", store))
	router.SetTrustedProxies(nil)
	router.LoadHTMLFiles("index.html")
	router.GET("/", func(c *gin.Context) {
		generateNonce(sessions.Default(c))
		c.HTML(http.StatusOK, "index.html", nil)
	})
	router.GET("/api/login/nonce", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"nonce": strconv.FormatUint(sessions.Default(c).Get("nonce").(uint64), 10),
		})
	})
	router.POST("/api/login", func(c *gin.Context) {
		session := sessions.Default(c)
		nonce := session.Get("nonce").(uint64)		
		generateNonce(session)
		var reqBody Login
		if err := c.BindJSON(&reqBody); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if isValidUser(reqBody.Email, reqBody.Password, nonce) {
			c.JSON(http.StatusOK, gin.H{
				"status": "ok",
			})
			return
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
	})
	router.Run()
}
```

Pada kode program di atas, saya menggunakan `rand.Uint64()` untuk menghasilkan sebuah angka 64-bit yang acak sebagai *nonce*.  Angka ini
kemudian disimpan ke dalam *session*.  Saya juga menambahkan *endpoint* `/api/login/nonce` untuk mendapatkan nilai *nonce* yang tersimpan
pada *session* yang sedang aktif dalam bentuk *string*.  Saya tidak menggunakan angka karena batas maksimum nilai angka literal
yang dapat diproses oleh JavaScript hanya 53-bit sementara angka *nonce* adalah 64-bit.

Selain itu, kode program di atas juga tidak memakai `STATIC_KEY` lagi.  Nilai *hash* kini  dihitung dengan *password* sebagai *key* dan *nonce* 
sebagai nilai pada kalkulasi HMAC. Agar perbandingan *hash*-nya sama, saya juga perlu mengubah kode program JavaScript di halaman HTML 
menjadi seperti berikut ini:

```javascript
let form = document.getElementById('form');
let output = document.getElementById('output');
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let email = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    let response = await fetch(`${location.origin}/api/login/nonce`, {method: 'GET'});
    const nonce = (await response.json()).nonce;
    let encoder = new TextEncoder();
    let key = await crypto.subtle.importKey('raw', encoder.encode(password), {name: 'HMAC', hash: {name: 'SHA-1'}}, false, ['sign']);
    const value = new DataView(new ArrayBuffer(8));
    value.setBigUint64(0, nonce);
    let hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, value));
    console.log(`Mengirim email [${email}] dan password [${hash}] ke backend`);
    response = await fetch(`${location.origin}/api/login`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password: Array.from(hash)}),
    });
    output.textContent += response.statusText + '\n';
});
```

Pada kode program JavaScript di atas, saya terlebih dahulu memanggil *endpoint* `/api/login/nonce` untuk mendapatkan nilai *nonce*
yang aktif.  Setelah itu, saya menggunakan `DataView` untuk menerjemahkan *nonce* dalam bentuk *string* menjadi angka 64-bit big endian.
Sama seperti di Go, saya juga menggunakan *password* sebagai *key* dan *nonce* sebagai nilai pada kalkulasi HMAC.

Sekarang, bila saya menggunakan halaman web ini, setiap kali `/api/login` dipanggil, nilai *hash* yang dikirim selalu berbeda setiap
kali di-eksekusi walaupun *hash* tersebut untuk *password* yang sama, seperti yang terlihat pada gambar berikut ini:

![Hashing Dengan Nonce Angka]({{ "/assets/images/gambar_00099.png" | relative_url}}){:class="img-fluid rounded"}

Dengan teknik ini, proses *hashing* lebih aman dari serangan *replay attack*.  Walaupun penyerang berhasil mendapatkan nilai *hash* yang
pernah terekam, nilai tersebut tidak bisa dipakai lagi untuk *login*.

#### Menambahkan Nonce Waktu Pada Proses Hashing

Salah satu kelemahan pada proses *hashing* di bagian sebelumnya adalah proses tersebut perlu menyimpan nilai *nonce* di sebuah tempat.  Sebagai contoh, 
saya menyimpan *nonce* di *session* dan menyediakan *endpoint* untuk mendapatkan nilai *nonce* yang sedang aktif.  Ini membuat
proses *login* menjadi sedikit lebih kompleks dari biasanya.  Sebagai alternatif, saya dapat menggunakan waktu sebagai nilai
*nonce* karena waktu selalu unik dan tidak dapat diputar ulang.

Sebagai contoh, saya akan mengubah kode program Go yang saya buat menjadi seperti berikut ini:

```golang
package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/binary"
	"github.com/gin-gonic/gin"
	"net/http"
	"time"
)

const EMAIL = "admin@jocki.me"
const PASSWORD = "password_rahasia_saya"

type Login struct {
	Email    string `json:"email" binding:"required"`
	Password []byte `json:"password" binding:"required"`
}

func hash(password []byte, nonce uint64) []byte {
	hmacSha1 := hmac.New(sha1.New, password)
	value := make([]byte, 8)
	binary.BigEndian.PutUint64(value, nonce)
	hmacSha1.Write(value)
	return hmacSha1.Sum(nil)
}

func isValidUser(email string, passwordHash []byte, nonce uint64) bool {
	if email != EMAIL {
		return false
	}
	expectedHash := hash([]byte(PASSWORD), nonce)
	if !hmac.Equal(passwordHash, expectedHash) {
		return false
	}
	return true
}

func generateNonce() uint64 {
	return uint64(time.Now().Unix()) / uint64(30)
}

func main() {
	router := gin.Default()
	router.SetTrustedProxies(nil)
	router.LoadHTMLFiles("index.html")
	router.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", nil)
	})
	router.POST("/api/login", func(c *gin.Context) {
		var reqBody Login
		if err := c.BindJSON(&reqBody); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if isValidUser(reqBody.Email, reqBody.Password, generateNonce()) {
			c.JSON(http.StatusOK, gin.H{
				"status": "ok",
			})
			return
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
	})
	router.Run()
}
```

Pada kode program di atas, saya menghasilkan *nonce* berdasarkan ekspresi `time.Now().Unix() / 30` sehingga selama 30 detik akan
selalu menghasilkan *nonce* yang sama.  Hal ini saya lakukan untuk mendukung selisih waktu maksimal 30 detik antara jam di *browser* 
dengan jam di *server*.

Berikutnya, saya akan mengubah kode program JavaScript di HTML agar menggunakan proses yang sama dalam menghasilkan *hash* seperti 
yang terlihat pada contoh berikut ini:

```javascript
let form = document.getElementById('form');
let output = document.getElementById('output');
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let email = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    const nonce = Math.floor((Date.now() / 1000) / 30);
    let encoder = new TextEncoder();
    let key = await crypto.subtle.importKey('raw', encoder.encode(password), {name: 'HMAC', hash: {name: 'SHA-1'}}, false, ['sign']);
    const value = new DataView(new ArrayBuffer(8));
    value.setBigUint64(0, BigInt(`${nonce}`));
    let hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, value));
    console.log(`Mengirim email [${email}] dan password [${hash}] ke backend`);
    let response = await fetch(`${location.origin}/api/login`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password: Array.from(hash)}),
    });
    output.textContent += response.statusText + '\n';
});
```

Pada kode program di atas, saya juga menggunakan *step* `30` detik dalam menghitung nilai *nonce*.  Nilai ini harus sama dengan nilai
yang saya pakai di *server*.

Sekarang, bila saya *login* berkali-kali di web, selama 30 detik, halaman *web* akan selalu mengirim *hash* yang sama.  Setelah 30 detik
berlalu, bila saya mencoba *login* lagi, *hash* yang dikirim ke *server* akan berbeda, seperti yang terlihat pada gambar berikut ini:

![Hashing Dengan Nonce Waktu]({{ "/assets/images/gambar_00100.png" | relative_url}}){:class="img-fluid rounded"}

Walaupun teknik ini masih memungkinkan *replay attack* selama 30 detik, namun teknik ini membuat proses *login* menjadi lebih
sederhana karena tidak melibatkan pertukaran angka *nonce*.  Teknik ini merupakan alternatif yang lebih disarankan 
terutama bila jam di *server* dan jam di *browser* dapat dipastikan ter-sinkronisasi dengan baik. 