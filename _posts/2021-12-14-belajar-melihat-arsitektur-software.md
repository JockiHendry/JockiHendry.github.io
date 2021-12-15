---
layout: post
category: Pemograman
title: Belajar Melihat Arsitektur Software
tags: [SoftwareDevelopment, GoogleCloudPlatform, Kubernetes, Docker, Firebase, FirebaseAuthentication, Firestore, SearchEngine, SpringBoot]
---

Pada suatu hari, saat berkunjung ke dokter umum, saya sudah mendapatkan resep obat hanya dalam beberapa menit. Bukankah setiap pasien adalah unik?  Sang dokter tidak memeriksa apa aktifitas saya selama beberapa hari terakhir, mengetahui apa saja yang saya konsumsi, termasuk menanyakan alergi, dan sebagainya.  Namun, bila sang dokter melakukan hal ini untuk seluruh pasiennya, saya tidak akan pernah mendapatkan antrian konsultasi.  Sepertinya dokter tersebut punya *preset* resep tertentu berdasarkan tipe pasien dan penyakit yang sedang populer.  Begitu juga saya tidak begitu berbeda: disaat saya harus merancang aplikasi dari nol, saya sudah punya beberapa *"setelan"* standar.  Pada artikel ini, saya akan membahas dua arsitektur di benak saya: *Kubernetes native* dan *cloud native*.  Dua arsitektur ini saling bertolak belakang sehingga mudah untuk melihat perbedaanya.  Saya juga telah menyediakan contoh implementasi *Kubernetes native* dapat dilihat di [GitHub latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0) dan contoh implementasi *cloud native* di [GitHub latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51).

Saya akan menggunakan arsitektur seperti di [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0) untuk aplikasi yang memprioritaskan keamanan, aplikasi yang harus bisa berjalan di *intranet* dengan koneksi luar yang terbatas, dan sebagainya.  Namun, bila saya adalah *startup* tanpa sumber modal yang pasti atau sebuah perusahaan dimana *software* adalah *cost center*, saya akan menggunakan arsitektur seperti di [latihan cloud native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51). Dengan menggunakan infrastruktur *serverless*, saya tidak perlu membayar mahal bila pengguna aplikasi masih sangat sedikit.  Selain itu, arsitektur tersebut juga tidak membutuhkan banyak programmer.

---

## latihan-k8s

Arsitektur yang saya pakai disini pada dasarnya adalah *microservices* dimana seluruh komponen-nya di-*deploy* di *cluster* Kubernetes. *Microservices* memudahkan pembagian tugas programmer sehingga masing-masing bisa bekerja tanpa harus menunggu tim yang mengerjakan *service* lainnya selesai.  Selain itu, *microservices* juga memudahkan sebuah *service* untuk di-*outsource* karena setiap setiap komponennya tidak begitu saling terikat dan mudah diganti (*loosely-coupled*).

Aplikasi ini saat di-*deploy* di Kubernetes akan terlihat seperti pada gambar berikut ini:

![Arsitektur latihan-k8s]({{ "/assets/images/gambar_00054.png" | relative_url}}){:class="img-fluid rounded"}

Saya akan menemukan *services* seperti berikut ini di Kubernetes:
* [Keycloak](https://keycloak.org) sebagai *resource server* di *authentication* berbasis OAuth2.  Ini mirip dengan Auth0, hanya saja Keycloak adalah aplikasi yang dikelola sendiri (self-hosted). Saya dapat menambahkan *user*, mengubah password, dan operasi sejenisnya yang berkaitan dengan *user* di aplikasi ini.  Data *user* nantinya akan disimpan di database PostgreSQL.
* [StockItemService](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0/stock-item-service) adalah sebuah *service* yang menangani item stok. *Service* ini dibuat dengan menggunakan [Spring Boot](https://spring.io/projects/spring-boot) yang menyimpan data ke database MongoDB melalui [Spring Data MongoDB](https://spring.io/projects/spring-data-mongodb) secara *reactive* dan juga menulis ke Elasticsearch melalui [Spring Data Elasticsearch](https://spring.io/projects/spring-data-elasticsearch). Proses tersebut berlangsung secara *asynchronous* dengan menggunakan [RabbitMQ](https://rabbitmq.com) sebagai *message bus*.  Spring Boot mendukung RabbitMQ melalui [Spring AMQP](https://spring.io/projects/spring-amqp).
* [RabbitMQ](https://www.rabbitmq.com) sebagai *message broker* yang dipakai untuk berkomunikasi sesama *service* secara internal.
* [MongoDB](https://mongodb.com) sebagai database yang dipakai oleh `StockItemService`.
* [Elasticsearch](https://www.elastic.co) yang dapat diakses oleh pengguna secara langsung untuk melakukan pencarian.
* [WebService](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0/web) adalah *front-end* web yang menggunakan [Angular](https://angular.io) sebagai *framework*.  File statis ini di-*host* oleh web server Nginx.

Terdengar rumit dan kompleks?  Yup, bila ini adalah satu dekade lalu, saya akan segera menarik nafas panjang saat membaca daftar di atas.  Dulu, semua ini adalah proses manual yang terkadang melibatkan proses kompilasi di Linux yang bisa saja gagal bila *dependency*-nya tidak tersedia.  Namun, zaman sekarang sudah berbeda.  Dalam waktu beberapa, aplikasi tersebut sudah bisa ter-install di Kubernetes dan siap untuk dijalankan.  Hal ini berkat *package manager* Kubernetes yang disebut [Helm](https://helm.sh).  Semua aplikasi yang saya butuhkan di atas sudah tersedia sebagai *chart* di Helm.  Sebagai contoh, untuk melakukan instalasi Keycloak, MongoDB, RabbitMQ, dan Elasticsearch, saya cukup memberikan mengerjakan [kubernetes/init.sh](https://github.com/JockiHendry/latihan-k8s/blob/9c52f787aa50d0020b6db7944c6f1fade40127c0/kubernetes/init.sh) yang isinya seperti berikut ini:

> <strong>$</strong> <code>helm repo add bitnami https://charts.bitnami.com/bitnami</code>

> <strong>$</strong> <code>helm repo add elastic https://helm.elastic.co</code>

> <strong>$</strong> <code>helm install keycloak -f keycloak-values.yaml bitnami/keycloak</code>

> <strong>$</strong> <code>helm install mongodb-item-stock -f mongodb-item-stock-values.yaml bitnami/mongodb</code>

> <strong>$</strong> <code>helm install rabbitmq -f rabbitmq-values.yaml bitnami/rabbitmq</code>

> <strong>$</strong> <code>helm install elasticsearch -f elasticsearch-values.yaml elastic/elasticsearch</code>

Pada arsitektur ini, seluruh *service* yang ada memiliki tipe `ClusterIP`.  Dengan demikian, seluruh *service* hanya memiliki IP internal yang tidak dapat diakses dari luar.  Satu-satunya cara untuk mengakses mereka adalah melalui *ingress controller*.  Pada percobaan lokal, saya menggunakan [NGINX ingress controller](https://kubernetes.github.io/ingress-nginx).  Pada file [kubernetes/ingress.yaml](https://github.com/JockiHendry/latihan-k8s/blob/9c52f787aa50d0020b6db7944c6f1fade40127c0/kubernetes/ingress.yaml), saya mengatur *ingress* supaya *requests* dengan tujuan `https://web.jocki.me` akan diarahkan ke `WebService`, `https://latihan.jocki.me/stock-item-service/*` akan diarahkan ke `StockItemService` dan `https://latihan.jocki.me/search/*` akan diarahkan langsung ke Elasticsearch.

Mengapa memakai *ingress*?  Supaya saya hanya perlu melakukan registrasi DNS `*.jocki.me` ke alamat IP *load balancer* saja.  Bila saya menggunakan alamat IP publik secara langsung untuk mengakses *sevice*, maka setiap kali ada *service* baru, saya harus menambahkan *record* baru di DNS karena *service* baru ini bisa jadi memiliki IP yang berbeda.  Fasilitas lain yang ditawarkan oleh *ingress* adalah dukungan HTTPS dengan menambahkan baris `tls` di konfigurasinya sehingga seluruh *service* bisa diakses 
melalui HTTPS (port 443) lewat *ingress*.  Tidak ada yang perlu diubah di implementasi *service* karena mereka tetap diakses melalui HTTP di port 80 oleh *ingress controller*.
Ini adalah kombinasi menarik karena ia memberikan dukungan HTTPS di Elasticsearch yang tidak tersedia di versi gratis-nya.

<div class="alert alert-warning" role="alert">
Pada latihan ini, saya menggunakan <em>self signed certificate</em> sehingga akan muncul pesan keamanan saat aplikasi dibuka di browser.  Selain itu, bila dijalankan
di komputer lokal melalui Minikube, saya perlu menambahkan baris baru di <code>/etc/hosts</code> secara manual bila tidak menggunakan <code>minikube addons enable ingress-dns</code>.  Saya akan menjadikannya sebagai topik di artikel selanjutnya.
</div>

Saat ini saya belum mempublikasikan *image* Docker ke *repository* publik, sehingga pada `imagePullPolicy` di [stock-item-service.yaml](https://github.com/JockiHendry/latihan-k8s/blob/9c52f787aa50d0020b6db7944c6f1fade40127c0/kubernetes/stock-item-service.yaml) dan [web-service.yaml](https://github.com/JockiHendry/latihan-k8s/blob/9c52f787aa50d0020b6db7944c6f1fade40127c0/kubernetes/web-service.yaml) memiliki
nilai `Never`.  Ini berarti bila menggunakan Minikube, saya harus men-*build* *image* Docker terlebih dahulu dengan menggunakan kode seperti (untuk proyek Spring Boot sudah tersedia task `bootBuildImage` yang akan men-*build* JAR tanpa harus membuat `Dockerfile`):

> <strong>$</strong> <code>eval $(minikube docker-env)</code>

> <strong>$</strong> <code>./gradlew bootBuildImage</code>

Bila menggunakan IDE dari Jetbrains, sudah terdapat dukungan Minikube sehingga saya hanya perlu klik sekali untuk men-*build*
*image* ke *cluster* Kubernetes yang dijalankan oleh Minikube.  Sebagai contoh, saya bisa men-*build* aplikasi Angular di Minikube dengan men-klik tombol panah hijau setelah melakukan konfigurasi Minikube seperti yang terlihat pada gambar berikut ini:

![Men-*build* Dockerfile langsung ke Minikube dari Webstorm]({{ "/assets/images/gambar_00055.png" | relative_url}}){:class="img-fluid rounded"}

Kode program untuk *front-end* terletak di folder [web](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0/web).  Disini saya menggunakan [angular-auth-oidc-client](https://npmjs.com/package/angular-auth-oidc-client) untuk
menangani flow OpenID Connect (OIDC) yang didukung oleh Keycloak.  Saya menambahkan `AutoLoginAllRoutesGuard` di [app-routing.module.ts](https://github.com/JockiHendry/latihan-k8s/blob/9c52f787aa50d0020b6db7944c6f1fade40127c0/web/src/app/app-routing.module.ts) sehingga setiap kali 
pengguna mengakses *route* yang dilindiungi, bila belum login, akan dibawa ke halaman Keycloak seperti pada gambar berikut ini:

![Login]({{ "/assets/images/gambar_00056.png" | relative_url}}){:class="img-fluid rounded"}

Bila login berhasil, pengguna akan dibawa kembali ke halaman *frontend*.  Pada [auth-config.module.ts](https://github.com/JockiHendry/latihan-k8s/blob/main/web/src/app/auth/auth-config.module.ts), saya juga menambahkan `secureRoutes` dengan nilai
`https://latihan.jocki.me/`.  Dengan demikian, setiap kali ada pemanggilan *endpoint* untuk URL yang diawali oleh `https://latihan.jocki.me/`, `HttpClient` akan menambahkan nilai JWT di header `Authorization`.  Ini dapat terjadi berkat fitur `HttpInterceptor` di Angular.  Saya juga perlu melakukan konfigurasi di *backend* untuk melakukan validasi JWT yang dikirim oleh *frontend*.  Sebagai contoh, saya melakukan konfigurasi [Spring Security](https://spring.io/projects/spring-security) di [SecurityConfiguration](https://github.com/JockiHendry/latihan-k8s/blob/main/stock-item-service/src/main/java/me/jocki/latihank8s/stockitemservice/SecurityConfiguration.java).  Konfigurasi ini akan melakukan validasi JWT berdasarkan informasi dari Keycloak.  Bila JWT yang diterima tidak valid atau sudah kadaluarsa, Spring Security akan menolak pemanggilan *endpoint* tersebut dengan status `403 - Access Denied`.

Setelah berhasil login, pengguna dapat melakukan pencarian item stok yang secara langsung memanggil Elasticsearch seperti yang terlihat pada gambar berikut ini:

![Pencarian Dengan Elasticsearch]({{ "/assets/images/gambar_00057.png" | relative_url}}){:class="img-fluid rounded"}

Sebenarnya akses Elasticsearch langsung dari *front end* tidak disarankan.  Walaupun demikian, saran ini boleh dilanggar bila saya menggunakan *ingress controller* atau
API Gateway yang mampu melakukan terminasi HTTPS, validasi JWT (*authorization*), pembatasan *request* dan *path* (misalnya tidak mengizinkan request dengan 
method `DELETE` yang akan menghapus database), dan sebagainya.

Selain itu, karena saya menerapkan pola [Command and Query Responsibility Segregation (CQRS)](https://microservices.io/patterns/data/cqrs.html) dimana Elasticsearch dipakai sebagai *view database* dan MongoDB sebagai *write database*, bila terjadi kerusakan di Elasticsearch, database MongoDB yang tidak di-ekspos ke publik tetap aman.  Penerapan pola CQRS yang saya lakukan terlihat seperti pada gambar berikut ini:

![Menambah Item Baru Dengan Pola CQRS]({{ "/assets/images/gambar_00058.png" | relative_url}}){:class="img-fluid rounded"}

Pada saat *endpoint* untuk membuat item stok baru dipanggil, terlihat bahwa [StockItemController.create()](https://github.com/JockiHendry/latihan-k8s/blob/9c52f787aa50d0020b6db7944c6f1fade40127c0/stock-item-service/src/main/java/me/jocki/latihank8s/stockitemservice/item/StockItemController.java#L31) hanya mengirimkan [CreateStokItemCommand](https://github.com/JockiHendry/latihan-k8s/blob/9c52f787aa50d0020b6db7944c6f1fade40127c0/stock-item-service/src/main/java/me/jocki/latihank8s/stockitemservice/item/CreateStockItemCommand.java) ke RabbitMQ.  Ini
akan membuat [StockItemCommandListener.handleCreateStockItemCommand()](https://github.com/JockiHendry/latihan-k8s/blob/9c52f787aa50d0020b6db7944c6f1fade40127c0/stock-item-service/src/main/java/me/jocki/latihank8s/stockitemservice/item/StockItemCommandListener.java) yang memiliki *annotation* `@RabbitListener()` dikerjakan (secara *asynchronous*).  Kode program tersebut akan menulis item stok baru ke MongoDB dan mengirimkan [StockItemCreatedEvent](https://github.com/JockiHendry/latihan-k8s/blob/9c52f787aa50d0020b6db7944c6f1fade40127c0/stock-item-service/src/main/java/me/jocki/latihank8s/stockitemservice/item/StockItemCreatedEvent.java) ke RabbitMQ.  Ini akan memicu [StockItemEventListener.handleStockItemCreatedEvent()](https://github.com/JockiHendry/latihan-k8s/blob/9c52f787aa50d0020b6db7944c6f1fade40127c0/stock-item-service/src/main/java/me/jocki/latihank8s/stockitemservice/item/StockItemEventListener.java#L22) yang memiliki *annotation* `@RabbitListener` untuk *exchange key* tersebut dikerjakan.  Kode program disini akan menulis ke Elasticsearch.  Pada contoh ini, semuanya dikerjakan oleh `StockItemService` sendiri, akan tetapi pada prakteknya, bisa saja `StockItemCreatedEvent` ditangani oleh Logstash atau *service* lain yang didedikasikan khusus untuk menulis ke Elasticsearch.

Mengapa menggunakan CQRS?  Pada kasus nyata, saat menampilkan item stok, biasanya diperlukan informasi dari *service* lain seperti estimasi harga.  Bila saya tidak memiliki sebuah *view database* yang berisi semua yang perlu ditampilkan, maka saya harus melakukan *joining* query setiap kali pengguna mengetik kata kunci pencarian.  Ini pastinya akan lebih lambat dari sekarang.  Selain itu, proses perubahan item stok seperti menambah item baru atau mengubah nama item, biasanya jarang terjadi.  Sebaliknya, operasi pencarian hampir selalu terjadi setiap menit.  Ini menunjukkan adanya perbedaan kebutuhan kapasitas baca dan kapasitas tulis.

---

## latihan-cloud-native

Pada [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0), saya dapat menjalankan aplikasi secara lokal tanpa terhubung ke Internet.  Walaupun aplikasi tersebut dapat di-*deploy* di platform cloud, yang saya butuhkan hanya layanan infrastruktur Kubernetes seperti Google GKE, AWS EKS, Azure AKS, dan sebagainya.  Aplikasi tersebut tidak membutuhkan layanan lain lagi dari platform cloud.  Sebagai kebalikannya, pada [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51), saya menggunakan arsitektur yang sebisa mungkin memanfaatkan layanan dari platform cloud tanpa harus mengelola sendiri (memprioritaskan *managed service*).  Sebagai contoh, saya menggunakan *cloud database* yang dikelola pihak luar seperti Firestore dan Algolia seperti yang terlihat pada gambar berikut ini:

![Arsitektur latihan-cloud-native]({{ "/assets/images/gambar_00059.png" | relative_url}}){:class="img-fluid rounded"}

Aplikasi ini tetap menggunakan prinsip *microservices* (boleh juga *miniservices* dan teknik *distributed computing* lainnya).  Hal ini masuk akal karena *microservices* pada dasarnya adalah tentang bagaimana merancang *service* yang satu agar bisa berkomunikasi dengan *service* lainnya tanpa harus terikat.  Hanya saja pada *cloud native*, *service in-house* yang saya buat harus berkomunikasi dengan *managed service* dari penyedia cloud.

Pada [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51), saya hampir tidak memiliki *backend*.  Walaupun ada, itu hanya sebuah *serverless function* yang mengatur *custom claim* sehingga tidak semua user dapat login dan memakai aplikasi. Untuk *authentication*, saya menggunakan [Firebase Authentication](https://firebase.google.com/docs/auth).  Firebase Authentication tidak memiliki UI bawaan sehingga saya menggunakan [firebaseui](https://npmjs.com/package/firebaseui) untuk menampilkan dialog *login* seperti berikut ini:

![Halaman Login]({{ "/assets/images/gambar_00060.png" | relative_url}}){:class="img-fluid rounded"}

Bila tidak ada *backend*, kenapa harus login?  Tentu saja saya tidak ingin semua orang bisa membuat item stok baru atau menghapus item yang sudah ada di aplikasi saya!  [Cloud Firestore](https://firebase.google.com/docs/firestore) memiliki mekanisme perlindungan yang terintegrasi dengan Firebase Authentication.  Dengan *rules* di Firestore, saya bisa menentukan akses ke data berdasarkan JWT user yang berhasil *login* (misalnya berdasarkan *user id*, email, *custom claim*, dan sebagainya).

Untuk halaman pencarian item stok, saya menggunakan [Algolia](https://www.algolia.com) yang menyediakan *plan* gratis.  Berbeda dari Elasticsearch di `latihan-k8s`, disini saya hanya perlu mendaftar di situs Algolia, mendapatkan *application id* dan *API key*, menambahkan *dependency* `angular-instantsearch` dan memakai komponen yang disediakan untuk mendapatkan hasil seperti pada gambar berikut ini:

![Halaman Pencarian Item]({{ "/assets/images/gambar_00061.png" | relative_url}}){:class="img-fluid rounded"}

Saya tetap menggunakan prinsip CQRS untuk memasukkan data dari Firestore ke Algolia.  Beruntungnya, saya tidak perlu menulis kode program sama sekali karena Algolia sudah memiliki Firebase Extensions untuk tugas seperti ini.  Saya cukup membuka Firebase Extensions dengan nama Search with Algolia di <https://firebase.google.com/products/extensions/algolia-firestore-algolia-search> dan men-klik tombol **Install in console** di halaman tersebut.  Saya kemudian mengisi *collection* Firestore yang akan dipakai sebagai *trigger*, lalu *application id* dan *API key* Algolia sebagai sasaran.  Setelah proses instalasi selesai, setiap kali *collection* di Firestore berubah,  maka perubahannya juga akan dikirim ke Algolia.  Semua berlangsung secara otomatis tanpa harus menulis satu baris kode sama sekali.  Ini mungkin lebih tepat bila disebut sebagai *no code development*.

Karena saya menggunakan `@angular/fire`, untuk men-deploy *front-end* ke [Firebase Hosting](https://firebase.google.com/docs/hosting), saya bisa memberikan perintah berikut ini:

```
$ ng deploy
```

Saya tidak perlu menggunakan NGINX sama sekali.  Firebase Hosting menggunakan CDN Fastly dengan infrastruktur yang tersebar di berbagai belahan dunia yang tentunya memiliki kinerja lebih baik dibandingkan dengan satu server NGINX tunggal saya.

---

## Perbandingan


#### Tingkat Kerumitan

Berikut ini adalah beberapa contoh kendala yang saya hadapi pada saat menulis [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51):
* Kode program yang dihasilkan otomatis oleh `ng new` tidak akan jalan lagi setelah ditambahkan `ng add @angular/fire`.  Masalah ini ternyata sudah dilaporkan di <https://github.com/angular/angularfire/issues/3090>.  Beruntungnya, sebagai solusi sementara, saya cukup mengubah versi Typescript ke versi `4.4.4`.
* Pada awalnya saya ingin menggunakan `ngx-auth-firebaseui` yang bukan hanya menyediakan dialog login, tetapi juga halaman profil.  Namun, sepertinya *library* tersebut tidak kompatibel dengan versi Angular terbaru dan juga Firebase modular.  Firebase sejak versi 9 memperkenalkan fasilitas [modular](https://firebase.google.com/docs/web/modular-upgrade) dengan metode `import` yang berbeda dari versi-versi sebelumnya.  Untuk mendukung kompatibilitas dengan kode lama, Firebase 9 menyediakan *library* *compat*, namun *compat* hanya solusi sementara sebelum *upgrade* ke versi *modular* sepenuhnya dilakukan karena *compat* mungkin akan dihapus di versi Firebase selanjutnya.
* Setelah menulis *front end* untuk Algolia yang menggunakan komponen seperti `<ais-instantsearch>`, `<ais-refinement-list>`, dan `<ais-hits>`, saya menemukan bahwa pencarian tidak bekerja sebagaimana seharusnya.  Butuh waktu sejenak sebelum saya menyadari bahwa saya harus melakukan konfigurasi di dashboard Algolia terlebih dahulu dengan menambahkan atribut yang dapat dicari ke bagian Searchable Attributes.  Begitu juga dengan *refinement list* untuk field `category` yang tidak bekerja: saya perlu menambahkan `category` ke `Attributes for faceting` di dashboard Algolia terlebih dahulu.

Dan ini adalah kendala yang saya hadapi saat menulis [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0):
* Saya menghabiskan cukup banyak waktu melakukan *tweaking* supaya Keycloak yang di-*deploy* di *cluster* Kubernetes yang sama.  Saat saya men-*deploy* di *cluster* yang sama, saya menggunakan `http://${KEYCLOAK_SERVICE_HOST}/auth/realms/latihan` sebagai nilai `issue-uri` sehingga Spring Security dapat menghubungi Keycloak melalui IP internal (nilai *environment variable* tersebut secara otomatis disediakan oleh Kubernetes).  Namun, nilai `jwk-set-uri`-nya adalah `http://auth.jocki.me/auth/realms/latihan` karena saya menggunakan domain *hardcoded* (lewat `/etc/hosts`).  Saat melakukan validasi JWT, Spring Boot akan melihat bahwa JWT dipublikasikan oleh `http://auth.jocki.me` bukan oleh `http://${KEYCLOAK_SERVICE_HOST}/auth/realms/latihan`.  Bila nilai *auto configuration* yang dikembalikan tidak tepat, Spring Security akan menolak token JWT karena perbedaan nama host berupai nilai IP internal dan `auth.jocki.me` saat di-akses dari luar.
* Saat mengakses Elasticsearch secara langsung di web, saya menemukan pesan kesalahan CORS.  Karena Elasticsearch diakses melalui *ingress controller*, pengaturan CORS harusnya saya lakukan di [kubernetes/ingress.yaml](https://github.com/JockiHendry/latihan-k8s/blob/9c52f787aa50d0020b6db7944c6f1fade40127c0/kubernetes/ingress.yaml) melalui `annotations` seperti `nginx.ingress.kubernetes.io/enable-cors`, `nginx.ingress.kubernetes.io/cors-allow-methods`, dan `nginx.ingress.kubernetes.io/cors-allow-origin`.  Pengaturan nilai `http.*` di `elasticsearch.yml` hanya berlaku untuk akses dari *load balancer* ke *pod* yang sepenuhnya merupakan komunikasi internal.
* Pada awalnya, saya cukup kebingungan apakah saya harus mendeklarasikan `Queue`, `Exchange` dan `Binding` secara manual.  Setelah membaca dokumentasi Spring AMQP, akhirnya saya menemukan bahwa saya cukup menggunakan *annotations* seperti `@QueueBinding`, `@Queue`, dan `@Exchange` di `@RabbitListener` untuk *method* yang akan dikerjakan saat pesan diterima.  Bila hanya sebuah `@Queue` kosong, Spring AMQP akan otomatis membuat *anonymous queue* yang akan dihapus setelah aplikasi ditutup.

Terlihat bahwa kebanyakan permasalahan [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51) lebih berfokus pada *frontend* semenatara permasalahan [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0) lebih ke arah *backend*.  Bukan hanya itu, ukuran *front end* yang dihasilkan oleh [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51) juga lebih besar, seperti yang terlihat pada hasil `ng build` berikut ini:

```
Initial Chunk Files           | Names                        |  Raw Size | Estimated Transfer Size
main.5105f9ba18d4bf07.js      | main                         |   1.06 MB |               267.19 kB
styles.a133bb3e7f4c8ce9.css   | styles                       |  93.21 kB |                10.75 kB
polyfills.86dc9dfd20a28379.js | polyfills                    |  36.22 kB |                11.50 kB
runtime.ea38cbb11d742c4e.js   | runtime                      |   2.77 kB |                 1.29 kB

                              | Initial Total                |   1.19 MB |               290.73 kB

Lazy Chunk Files              | Names                        |  Raw Size | Estimated Transfer Size
558.25594eea4a5d46da.js       | stock-item-stock-item-module | 324.19 kB |                69.20 kB
```

Bandingkan dengan hasil `ng build` untuk [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0) yang terlihat seperti berikut ini:

```
Initial Chunk Files           | Names                        |  Raw Size | Estimated Transfer Size
main.8815b2f8945b1c88.js      | main                         | 576.06 kB |               136.48 kB
styles.68b2a3d9e76ca2bd.css   | styles                       |  71.93 kB |                 7.43 kB
polyfills.7aba22bcf46481be.js | polyfills                    |  36.19 kB |                11.50 kB
runtime.66c4b68b966d53c0.js   | runtime                      |   2.69 kB |                 1.26 kB

                              | Initial Total                | 686.87 kB |               156.67 kB

Lazy Chunk Files              | Names                        |  Raw Size | Estimated Transfer Size
399.78c48bb669227d48.js       | stock-item-stock-item-module | 183.40 kB |                35.73 kB

```

*Initial Chunk Files* adalah berkas yang akan di-*download* saat halaman web pertama kalidibuka.  Setelah itu, *Lazy Chunk Files* akan di-*download* atau tidak tergantung apakah pengguna mengakses *route* tersebut (misalnya melalui tombol yang di-klik).  Iimplementasi ini dilakukan dengan menggunakan [lazy-loading feature modules](https://angular.io/guide/lazy-loading-ngmodules).  Mengapa [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51) memiliki ukuran lebih besar?  Hal ini karena ia memang lebih kompleks dan menggunakan *library* seperti `firebase`, `firebaseui`, `angular-instantsearch` dan `algoliasearch`.   

**Pemenang**: [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51) - walaupun lebih kompleks di sisi *front end*, secara keseluruhan ia tetap lebih mudah di-implementasi-kan.  

### Proses Development:

Pada [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0), saya dapat menjalankan aplikasi di komputer lokal tanpa harus terhubung ke Internet sama sekali.  Hal ini karena semua *backend* yang saya butuhkan sudah tersedia di dalam *cluster* Kubernetes saya.  Seusai melakukan perubahan pada kode program, saya men-*deploy* *image* berdasarkan langsung ke Minikube, memberikan perintah `kubectl rolling-update`, dan seketika bisa merasakan perubahannya.  Bila terjadi kesalahan, saya dapat mencari tahu informasi lebih lanjut dengan melihat logs dengan memberikan perintah `kubectl logs`.  Bila ingin menggunakan GUI, saya bisa menjalankan `minikube dashboard`.

Pada [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51), saat menguji aplikasi, saya harus selalu terhubung ke Internet.  Firebase menyediakan [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulators-suite), namun tidak demikian dengan Algolia dan juga *managed services* lain yang akan saya pakai di kemudian hari.  Selain itu, saya harus melakukan pemisahan *managed service* yang dipakai di *staging* dan *production*.  Bila saat menguji modul pembayaran, saya tidak sengaja membuat invoice pembayaran baru untuk seluruh pelanggan yang ada dan *payment gateway*-nya sama seperti di *production*, maka seluruh pelanggan akan mendapatkan kiriman email tagihan yang tidak seharusnya ada.  Ini sangat tidak diharapkan, bukan?  Oleh sebab itu, saya perlu melakukan pemisahan *managed service*, misalnya dengan menggunakan konsep *namespace* atau *environment* bila didukung, atau dengan membuat akun berbeda khusus untuk *staging*.

Untuk backend *serverless* di [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51), saya sebisa mungkin menguji menggunakan *unit test* terlebih dahulu.  Di *unit test* tersebut, saya akan mengakses Firestore secara lokal melalui Firebase Local Emulator Suite dan melakukan *mocking* untuk *service* lainnya yang tidak dapat diemulasikan.  Bila tidak demikian, untuk mengetahui apakah kode program saya bekerja atau tidak, saya harus menjalankan `firebase deploy` dan menunggu satu menit untuk proses *deployment* (tergantung kecepatan koneksi internet) lalu membaca log Cloud Function di Google Cloud Dashboard.

Selan itu, pada platform *serverless*, penyedia layanan biasanya akan mematikan dukungan untuk teknologi yang dianggap sudah usang.  Sebagai contoh, saat ini dukungan Node.js terbaru untuk Cloud Functions adalah Node.js 16.  Dukungan Node.js paling rendah adalah Node.js 10 dimana dukungan Node.js 8 dihentikan sejak 5 Juni 2020.  Suatu hari kode program yang hari ini saya tulis dengan menggunakan Node.js 14 akan berhenti didukung sehingga mau tidak mau saya harus memperbaharui-nya saat waktunya tiba.  Sebagai perbandingan, saya memiliki kode program Java yang menggunakan Java 7 dan masih dipakai hingga saat ini tanpa pernah diubah sedikitpun. 

**Pemenang**: [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0) - Kubernetes mendukung *namespace* dan saya bisa mengganti *service* tertentu seperti user, pembayaran, dan email dengan *dummy service* atau dengan *database* yang berbeda saat melakukan *development* dan/atau untuk keperluan *staging*.     

### Biaya

Sebagai perbandingan, saya akan menggunakan <https://cloud.google.com/products/calculator> untuk melihat estimasi biaya.  Anggap saja saya men-*deploy* [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0) ke GKE dengan 3 *node* dengan mesin `n1-standard1` (1 vCPU dan memory 3.75 GB): total estimasinya adalah $72,82 per bulan.  Ini belum ditambah *human resources* seperti DevOps yang  mengelola Kubernetes, programmer *backend* yang menggunakan Spring dan programmer *frontend* yang menggunakan Angular.

Pada [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51), Firebase menyediakan kuota gratis untuk Firestore sebanyak 20.000 operasi tulis per hari dan 50,000 operasi baca per hari dengan gratis 1 GB penyimpanan.  Bila operasi sehari-harinya kurang dari itu, saya tidak perlu membayar sama sekali.  Algolia juga menyediakan kuota gratis sebanyak penyimpanan 10.000 record dan 10.000 pencarian per bulan.  Setelah itu, saya perlu membayar $1 untuk setiap 1.000 operasi tambahan di bulan tersebut.  Saya hanya membutuhkan programmer *frontend* yang menggunakan Angular.  Sesekali, programmer *frontend* ini mungkin perlu menulis Cloud Functions dengan menggunakan Node.js.  Programmer *frontend* tidak akan segan menyentuh Node.js karena masih sama-sama menggunakan JavaScript (dan TypeScript).

Namun, untuk [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51), saya tetap harus membayar untuk *managed services* yang dipakai selama *development* dan *staging*.  Biayanya mungkin tidak besar, tapi terkadang *staging* bisa menyebabkan tagihan yang membengkak juga.  Bayangkan bila developer tidak sengaja men-*push* perubahan kode program di *staging* yang mengirim email tanpa henti di *staging* setiap detik selama seminggu :) Sebagai perbandingan, untuk [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0), bila saya tidak menemukan *hosting* Kubernetes yang murah, saya bisa menggunakan Minikube di satu *server* tunggal sebagai *development* dan/atau *staging*.

**Pemenang**: [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51) - terutama bila aplikasi yang dikembangkan adalah *prototype* untuk validasi ide yang tidak perlu di-*maintain* dalam jangka panjang.

### Fleksibilitas

Pada [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0), karena semua *service* dikelola sendiri, tingkat fleksibilitas-nya sangat tinggi.  Sebagai contoh, bila saya merasa Keycloak tidak tepat lagi, saya tinggal menggantinya dengan alternatif seperti kode program yang saya tulis sendiri berdasarkan Spring Authorization Server.  Ingin bereksperimen dengan Apache Solr tapi tidak ingin langsung beralih dari Elasticsearch?  Saya dapat menambahkan *service* baru seperti `solr-search` dan terus mempertahankan Elasticsearch yang sudah ada dimana setiap kali `StockItemCreatedEvent` terjadi, kedua mesin pencari tersebut akan diperbaharui.  Saya kemudian bisa mengatur *ingress controller* supaya 50% pencarian diarahkan ke Elasticsearch dan 50% lagi diarahkan ke Apache Solr untuk melihat perbedaannya.

Ingin mencoba *frontend* baru?  Saya cukup menambahkan *web* baru dengan React.  Karena kebanyakan *driving code* berada di *backend*, menambahkan *frontend* baru bukanlah hal yang kompleks. Sebagai perbandingannya, pada [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51), banyak kode penting seperti operasi baca/tulis database dilakukan di *frontend*, sehingga membuat *frontend* baru berarti harus melakukan replikasi semua *logic* yang sudah ada.  Selalu ada kemungkinan kode program menjadi sangat kompleks di *frontend*.  Secara pribadi, saya merasa ini seperti memindahkan *monolith* dari *backend* ke *frontend*.  Di *backend*, *monolith* ini bisa dipecah-pecah menjadi *microservices*.  Namun, bila sudah berada di *frontend*, *monolith* ini akan membuat aplikasi sangat sulit dimodifikasi tanpa menimbulkan kesalahan.  Web menjadi lambat dan programmer web-nya pun menjadi *defensive* karena sedikit salah tulis bisa menghapus isi database :) 

Walaupun memakai layanan atau komponen dari pihak ketiga selalu lebih mudah, terkadang bisa jadi tidak fleksibel dan sulit di-*debug*.  Sebagai contoh, pada [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51), saat saya mengetik secara cepat di kotak pencarian, beberapa huruf yang saya ketik seperti hilang dan urutannya terkadang berubah.  Saya tidak menemukan masalah ini di [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0) karena disana saya memakai `<input type="text">` biasa yang saya jadikan *trigger* secara reaktif melalui `FormControl.valueChanges.subscribe()`.  Namun di [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51), ini adalah `<ais-search-box>` yang merupakan bawaan `angular-instantsearch`.  Bila saya ingin mencari tahu apa penyebab permasalahan saya, saya harus mempelajari lebih lanjut bagaimana cara kerja `<ais-search-box>`.

**Pemenang**: [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0) - bila kebutuhan tidak terlalu kompleks, [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51) juga bukan merupakan pilihan yang buruk.

### Kemananan

Bila keamanan adalah prioritas utama dan data identitas pengguna tidak boleh disimpan oleh layanan pihak ketiga, [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0) adalah pilihan utama saya.  Administrator di perusahaan juga akan lebih bahagia karena ia hanya perlu memperbolehkan akses ke `*.jocki.me` (yang diasosiasikan dengan alamat IP *ingress controller*) dari dalam perusahaan.  Pada [latihan-cloud-native](https://github.com/JockiHendry/latihan-cloud-native/tree/3a6e06579254ad32aeb190014481af3612c33c51), browser pengguna harus menghubungi server Firestore dan juga server yang dipakai oleh Algolia.  Khusus untuk Firestore, WebChannel yang dipakai untuk men-*push* perubahan dari *server* ke *browser* terkadang bermasalah dengan *proxy server* yang dipakai oleh perusahaan seperti yang didiskusikan di <https://github.com/firebase/firebase-js-sdk/issues/1674>.

Salah satu kelemahan [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0) adalah saya harus siap men-*deploy* perubahan terbaru bila ada celah keamanan kritis yang ditemukan.  Sebagai contoh, akhir pekan ini, banyak yang harus masuk kerja melakukan *rolling update* karena terdapat pengumuman [celah keamanan Log4j](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2021-44228) untuk publik di hari Jumat.  Bila menggunakan *managed service*, ini adalah tanggung jawab tim DevOps mereka dan saya bisa menghabiskan akhir pekan dengan tenang. 

**Pemenang**:  [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/9c52f787aa50d0020b6db7944c6f1fade40127c0) - akses dibatasi *ingress controller*, data Personally Identifiable Information (PII) tetap berada di dalam *cluster* Kubernetes bila saya tidak mengirimnya ke *service* luar.