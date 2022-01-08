---
layout: post
category: DevOps
title: Melakukan Load Testing Dengan Locust
tags: [Python, Kubernetes]
---

Bila bicara soal *load testing*, yang terbayang dalam kepala saya adalah [Apache JMeter](https://jmeter.apache.org/).  Namun kali ini saya akan mencoba sebuah *tool* baru yang disebut [Locust](https://locust.io).  Salah satu perbedaan utamanya adalah definisi tugas pengujian JMeter dilakukan melalui UI sementara definisi pengujian Locust ditulis melalui kode program Python.  Mana yang sebenarnya lebih mudah dan intuitif?  Secara logika, seharusnya JMeter, bukan?  Tapi entah mengapa saya merasa banyak yang butuh waktu untuk mempelajari UI JMeter sebelum bisa mulai bekerja dengannya.  Sementara itu, karena skenario Locust adalah kode program Python, pembuat skenario bisa *copy paste* dan menerapkan teknik pemograman yang sudah biasa mereka pakai.

<div class="alert alert-light" role="alert">
Ini hampir sama seperti yang dibicarakan penulis artikel <a href="https://martinfowler.com/articles/cant-buy-integration.html">You Can't Buy Integration</a>: "the key (no pun intended) to simplifying the interface is to accept a more complex implementation."  Terkadang manajer dari latar belakang non-teknis berpikir bisa menyelesaikan masalah dengan membeli tool canggih dan mahal, lalu saat terjadi kendala, mereka berpikir: "pakai tool canggih saja masih delay, apalagi ga pakai".  Sementara itu, yang terjadi di lapangan adalah programmer mereka berpikir: "Kalo bukan karena pakai tool ini untuk mengimplementasikan fitur yang tidak didukung pembuatnya, pekerjaan saya sudah selesai dari tahun lalu."
</div>
 
Untuk memakai Locust, saya menambahkannya dengan menggunakan pip di proyek Python saya seperti pada perintah berikut ini:

> <strong>$</strong> <code>pip install locust</code>

Karena ini adalah kode program biasa, saya juga bisa menambahkan *library* lain, misalnya saya akan memakai faker untuk menghasilkan teks acak:

> <strong>$</strong> <code>pip install faker</code>

Setelah itu, saya membuat sebuah file dengan nama `locustfile.py` dengan isi seperti berikut ini:

```python
import faker
from locust import HttpUser, task, between

fake = faker.Faker()


class InventoryUser(HttpUser):

    host = 'https://api.latihan.jocki.me'
    access_token = None
    wait_time = between(1, 5)

    def on_start(self):
        response = self.client.post(
            'https://auth.latihan.jocki.me/auth/realms/latihan/protocol/openid-connect/token',
            headers={
                'Authorization': 'Basic bG9jdXN0OjRmNzAzNzY0LTllYjItNGUxYS1iM2QyLWY2YmVhMTY0NTIwMw==',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data={
                'grant_type': 'urn:ietf:params:oauth:grant-type:uma-ticket',
                'audience': 'locust',
            }
        )
        self.access_token = response.json()['access_token']

    @task
    def create_item(self):
        self.client.post(
            '/stock-item-service/items',
            headers={
                'Authorization': 'Bearer ' + self.access_token
            },
            json={
                "sku": fake.bothify(text="???-#####"),
                "name": fake.name(),
                "quantity": fake.random_int(),
                "category": fake.random_element(('CPU', 'Memory', 'Storage', 'Motherboard', 'GPU'))
            }
        )
```

Kode program di atas mewakili apa yang akan dilakukan oleh seorang `User`.  Locust akan mengerjakan method `on_start()` pada saat `User` dibuat dan `on_stop()` pada saat `User` di-hentikan (misalnya saat pengguna men-klik tombol Stop).  Untuk memanggil API di https://api.latihan.jocki.me, pengguna perlu login terlebih dahulu.  Untuk mempermudah proses login, saya menggunakan metode [Client Credentials Flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/client-credentials-flow) yang cocok untuk komunikasi antar *service* (*machine to machine*).

Untuk itu, saya membuat sebuah *client* baru di Keycloak dengan nama `locust`, mengisi nilai "Access Type" dengan `confidential` dan mengaktifkan Authorization Enabled (serta mematikan Standard Flow Enabled).  Karena tidak ingin menangani *token* yang kadaluarsa, saya mengisi mengisi Access Token Lifespan (di bagian Advanced Settings) dengan nilai yang besar seperti 5 jam.  Dengan demikian, saya tidak akan mengalami masalah dengan *token* selama melakukan pengujian tidak lebih dari 5 jam.  Saya bisa mendapatkan nilai Client Secret di bagian Secret di tab Credentials.  Saya kemudian menyertakan nilai kombinasi *client id* dan *client secret* seperti `locust:12345678` dalam bentuk *base64 encoded* di header Authorization di kode program `on_start`.  Keycloak kemudian akan mengembalikan sebuah JSON yang berisi property `access_token` yang dapat saya pakai saat memanggil API.

Bila menggunakan `kcadm.sh`, saya bisa memberikan perintah berikut ini:

> <strong>$</strong> <code>kcadm.sh create clients -r latihan -s clientId=locust -s enabled=true \</code><br>
> <code>-s serviceAccountsEnabled=true -s authorizationServicesEnabled=true -s standardFlowEnabled=false \</code><br>
> <code>-s clientAuthenticatorType=client-secret -s secret=12345678 -s 'attributes={"access.token.lifespan":18000}' \</code><br>
> <code>--no-config --server https://auth.latihan.jocki.me/auth --user user --password password --realm master</code>

<div class="alert alert-warning" role="alert">
<p>Client Credentials Flow menggunakan <em>client id</em> dan <em>client secret</em> yang hampir sama seperti <em>username</em> dan <em>password</em> di Basic Authentication.  Lalu apa bedanya?  Pada Basic Authentication, <em>username</em> dan <em>password</em> harus selalu dilewatkan saat memanggil API.  Bila berhasil disadap, mereka bisa dipakai kapan saja selama belum diganti.  Sementara itu, pada Client Credentials Flow, <em>client id</em> dan <em>client secret</em> hanya perlu dilewatkan sekali saja untuk mendapatkan sebuah <em>access token</em>.  Selanjutnya, saat memanggil API, <em>access token</em> ini yang akan dipakai.  <em>Access token</em> memiliki masa hidup yang singkat seperti 5 menit dan selanjutnya perlu diperbaharui melalui <em>refresh token</em>.  Penyadap hanya bisa mendapatkan <em>access token</em> dengan menyadap komunikasi di server API; itupun tidak akan bisa digunakan lagi setelah kadaluarsa.</p>

<p>Dengan meningkatkan masa kadaluarsa <em>access token</em> menjadi 5 jam, saya sudah meningkatkan resiko bila terjadi serangan.  Akan tetapi, sebagai gantinya, kode program pengujian lebih mudah.  Lagi pula, <em>client id</em> ini tidak akan dipakai oleh <em>server</em> lain.</p>    
</div>

Sebagai perbandingan, untuk mencapai hal yang sama di JMeter, saya perlu menambahkan konfigurasi HTTP Request untuk memanggil Keycloak, HTTP Header Manager untuk menyertakan *client id* dan *client secret*, JSON Extractor untuk mengambil nilai *access token* yang dikembalikan dan BeanShell Assertion untuk menyimpan *access token* agar bisa dipakai oeh HTTP Request lainnya, seperti yang diperlihatkan oleh gambar berikut ini: 

![Login Di JMeter]({{ "/assets/images/gambar_00068.png" | relative_url}}){:class="img-fluid rounded"}

Mereka yang baru mengenal JMeter mungkin akan bingung memilih apa yang harus dipakai untuk mengambil nilai JSON (jawabannya: JSON Extractor), sementara mereka yang membaca kode program Python `self.access_token = response.json()['access_token']` biasanya langsung mengerti kalo baris ini akan menyimpan nilai ke variabel.  Terkadang UI justru membingungkan karena penggunanya harus memahami terminologi yang dipakai (misalnya apa itu JSON Extractor dan BeanShell Assertion) serta membaca dokumentasi untuk mengetahui apa yang harus di-isi di sekian banyak *input* yang tersedia.   

Pada saat saya menjalankan Locust, method yang memiliki annotation `@task` seperti `create_item()` akan terus dikerjakan berulang kali untuk `User` bersangkutan hingga saya mematikan Locust.  Sebagai contoh, saya bisa menjalankan pengujian dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>locust</code>

Locust akan membaca skenario yang saya tulis di `locustfile.py` dan menuliskan sebuah link untuk membuka web interface-nya.  Sebelum pengujian dimulai, saya dapat menentukan jumlah user, seberapa banyak user baru di buat setiap detiknya serta lokasi server.  Saya kemudian men-klik tombol **Start swarming** untuk memulai pengujian.  Pengujian akan terus berlangsung hingga saya meng-klik tombol Stop.  Hasil yang saya peroleh terlihat seperti pada gambar berikut ini:

![Hasil Load Test Di Locust]({{ "/assets/images/gambar_00069.png" | relative_url}}){:class="img-fluid rounded"}

Terlihat bahwa pada awalnya aplikasi ini memiliki kecepatan yang stabil.  Namun saat dipaksakan lebih lanjut, *pod* RabbitMQ dan MongoDB akan berubah ke status *unhealthy*.  Kubernetes-pun akan me-*restart* *pod* yang tidak responsif.  Namun karena saya hanya memakai sebuah *pod* tunggal, pengguna akan mendapatkan respon kesalahan saat proses *restart* terjadi.  Pada akhir dari grafis, banyak pesan kesalahan dari *ingress controller* dengan kesalahan 504 Gateway Time-out.  Ini mungkin terjadi karena saturasi jaringan yang tinggi mengingat saya melakukan pengujian di komputer yang sama.  Untuk hasil yang sempurna, Locust harus dijalankan pada *cluster* berbeda sambil melakukan pemantauan pada penggunaan CPU, memori dan jaringan sehingga identifikasi *bottleneck* (apakah di Locust atau di aplikasi yang diuji) bisa lebih mudah dilakukan.  

Walaupun nilai RPS di hasil pengujian lokal tidak memilih nilai yang berarti, saya tetap bisa menggunakan grafis di atas sebagai *baseline* bila saya melakukan perubahan pada aplikasi.  Sebagai contoh, bagaimana bila saya mengubah database MongoDB yang dipakai menjadi MySQL Server?  Walaupun terlihat sederhana, ini melibatkan cukup banyak perubahan karena driver JDBC masih melakukan *blocking* pada *thread* sehingga saya tidak bisa memakai Spring WebFlux.  Pada saat memakai *reactive stream* di WebFlux, bila proses penulisan ke MongoDB gagal, *operator* berikutnya yang mempublikasikan *event* tidak akan dikerjakan.  Tetapi saat kembali ke cara *"lama"*, untuk memastikan *event* dipublikasikan hanya setelah proses *commit* berhasil, saya harus menggunakan `TransactionalEventListener`.  Selain itu, saya juga perlu mendefinisikan *schema* dengan FlyWay.  Ini adalah hasil pengujian yang saya peroleh terlihat saat menjalankan Locust kembali:

![Hasil Load Test Di Locust]({{ "/assets/images/gambar_00070.png" | relative_url}}){:class="img-fluid rounded"}

Setelah mencapai sekitar 735 pengguna, tiba-tiba *pod* untuk Spring Boot menjadi tidak responsif.  Setelah di-*restart* oleh Kubernetes, tidak lama kemudian *pod* menjadi tidak responsif lagi.  Saya menemukan banyak pesan kesalahan `NullPointerException` di log aplikasi tersebut.  Bila dibandingkan dengan versi sebelumnya, pengalaman ini lebih buruk karena *bottleneck*-nya di aplikasi Spring Boot yang sampai *crash* dengan kesalahan yang sebelumnya tidak ada.