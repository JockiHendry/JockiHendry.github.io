---
layout: post
category: DevOps
title: Memakai Docker Compose Untuk AppEngine
tags: [AppEngine, Docker]
---

Pada suatu hari, saya menulis `README.md` berisi panduan bagi programmer untuk menjalankan aplikasi yang saya deploy di Google Cloud Platform.  Seperti layaknya aplikasi *microservices*, aplikasi tersebut terdiri atas proyek App Engine dan beberapa modul Cloud Functions.  Komunikasi antar *service* dilakukan melalui Cloud Pub/Sub. Database yang dipakai adalah MySQL dan Cloud Datastore.  Terdengar rumit, bukan?  Saya perlu memutar otak untuk menulis lebih dari dua paragraf guna menjelaskan langkah-langkah yang dibutuhkan untuk menjalankan aplikasi dari awal.  Ini masih belum termasuk peringatan seperti masalah emulator lokal Cloud Functions yang tidak mendukung Node 8 sementara Angular CLI terbaru mewajibkan minimal Node 8.  Apakah ada cara yang lebih singkat bagi programmer lain untuk menjalankan aplikasi ini di laptop barunya?

Salah satu solusinya adalah dengan menggunakan Docker Compose.  Saya akan mencoba menyederhanakan langkah-langkah yang sebelumnya saya tulis dalam bentuk panduan menjadi sesuatu yang otomatis dengan bantuan Docker Compose.  Karena Docker Compose menggunakan Docker Engine, saya akan mulai dengan melakukan instalasi Docker terlebih dahulu dengan mengikuti panduan di <https://docs.docker.com/install>.  Setelah itu, saya melakukan instalasi Docker Compose dengan mengikuti panduan di <https://docs.docker.com/compose/install>.

Langkah berikutnya adalah menambahkan `Dockerfile` pada masing-masing proyek yang mewakili sebuah *service*.  Untuk proyek App Engine Java, saya bisa membuat `Dockerfile` dengan isi seperti berikut ini:

```dockerfile
FROM google/cloud-sdk:latest
RUN apt-get update && apt-get install -y maven
COPY . /src
WORKDIR /src
EXPOSE 8080
CMD mvn -DskipTests -Dapp.devserver.host="0.0.0.0" appengine:run
```

Saya bisa saja langsung menjalankan *container* yang dihasilkan dari `Dockerfile` di atas.  Akan tetapi aplikasi tidak akan bekerja karena database MySQL yang dibutuhkan belum ada.  Ini adalah saat dimana Docker Compose dibutuhkan!  Untuk menggunakan Docker Compose, saya perlu membuat sebuah file baru dengan nama `docker-compose.yml`.  File ini harus berada di lokasi folder umum di luar masing-masing project yang dikelolanya, misalnya seperti pada contoh berikut ini:

```
|
|-- folder project1 (service yang dibuat dengan AppEngine Java)
|   |-- Dockerfile
|
|-- folder project2 (service yang dibuat dengan Google Cloud Functions)
|   |-- Dockerfile
|
|-- docker-compose.yml
|
```

Saya pun kemudian menulis isi berikut ini pada `docker-compose.yml`:

```yml
version: '3'
services:
  project1:
    build: ./project1
    ports:
      - "8080:8080"
    depends_on:
      - db
    environment:
      SPRING_DATASOURCE_URL: "jdbc:mysql://db:3306/nama_database?useSSL=false&useLegacyDatetimeCode=false&serverTimezone=UTC"
      SPRING_DATASOURCE_USERNAME: nama_user
      SPRING_DATASOURCE_PASSWORD: 12345678
  db:
    image: mysql:5.7
    environment:
      MYSQL_DATABASE: nama_database
      MYSQL_USER: nama_user
      MYSQL_PASSWORD: 12345678
      MYSQL_ROOT_PASSWORD: password_root_sangat_rahasia
```

Pada konfigurasi di atas, terdapat dua buah *service* yang masing-masing akan mewakili sebuah *container* Docker.  Dengan demikian, konfigurasi di atas akan menjalankan dua *instance* dari *container* yang berbeda: `project1` dan `db`.

Pada Docker, setiap *container* dibuat berdasarkan *image*.  Untuk `project1`, *image* akan dibuat berdasarkan isi `Dockerfile` di folder `project1`.  Untuk *service* `db`, *image* akan di-*download* dari Docker Hub, tepatnya di <https://hub.docker.com/_/mysql/>.  Saya menambahkan *tag* `5.7` setelah nama *image* untuk memastikan versi MySQL yang dipakai.

Saya juga menambahkan beberapa *environment variables* sebagai konfigurasi seperti mengubah nama database, nama user dan password user dengan menambahkan `environment` di `db`.  Hampir semua *image* resmi di Docker Hub menyediakan pengaturan melalui *environment variables*. Cukup baca petunjuk dari pihak yang mengelola *image* tersebut untuk mendapatkan informasi lebih lanjut.  Lalu bagaimana dengan *environment variables* yang saya berikan di `project1`?  Ini adalah fasilitas Spring Boot dimana *environment variable* seperti `SPRING_DATASOURCE_URL` akan menimpa nilai `spring.datasource.url` di file properties yang dipergunakan (seperti `application.properties`).  Dengan demikian, saya tetap bisa melakukan pengaturan tanpa harus mengubah kode program.

Kedua *container* Docker pada konfigurasi ini sewajarnya akan berjalan secara terisolasi dan tidak saling berhubungan.  Anggap saja seperti menjalankan dua buah *virtual machine* yang berbeda (pada Docker, *virtual machine* adalah *container*).  Docker Compose membuat semuanya lebih mudah: sebuah *container* dapat mengakses *container* lainnya yang didefinisikan pada file yang sama cukup dengan menggunakan nama *service* yang hendak dipanggil.  Sebagai contoh, saya bisa menggunakan JDBC URL seperti `jdbc:mysql://db:3306/nama_database` dimana nilai `db` akan merujuk pada alamat IP untuk *container* `db`.  Saya juga bisa memanggil perintah seperti `ping project1` dari *container* `db` atau `ping db` dari *container* `project1`.

Lalu bagaimana dengan komputer *host* (sebutan untuk komputer yang menjalankan Docker)?  Saya tidak bisa mengakses port `8080` milik `project1` di komputer *host* begitu saja!  Docker mengatur isolasi jaringan dengan baik sehingga saya bisa  menjalankan lebih dari satu database MySQL atau emulator App Engine tanpa harus khawatir terjadi bentrokan.  Tapi ada kalanya saya perlu mempublikasikan port agar bisa diakses oleh komputer *host*.  Untuk itu, pada definisi service `project1`, saya menambahkan klausa `ports` dengan nilai `8080:8080`.  Ini berarti port `8080` di *container* Docker boleh diakses oleh komputer *host* pada port `8080`.  Agar ini bekerja, saya perlu memastikan bahwa aplikasi yang dijalankan di dalam *container* melalukan *binding* ke IP `0.0.0.0`.  Hal ini bisa terlihat dari penggunaan `-Dapp.devserver.host="0.0.0.0"` di Dockerfile di folder `project1`.  Tanpa tambahan argumen ini, emulator lokal App Engine akan melakukan *binding* ke IP `localhost`.

Mengapa menambahkan `ports` untuk `project1`? Dengan konfigurasi ini, saya bisa mengakses `project1` dengan mengetikkan URL seperti <http://localhost:8080> di browser di komputer *host*.  Port yang tidak dipublikasikan seperti port `3306` milik MySQL menyebabkan saya tidak bisa mengakses MySQL cara langsung dari komputer *host*; saya perlu menggunakan perintah seperti `docker exec -it db_1 bash` untuk *'masuk'* kedalamnya.  Ini adalah seharusnya, bahkan aman, karena pengguna memang tidak boleh mengakses database secara langsung.

<div class="alert alert-info" role="alert">
  <h4 class="alert-heading">Sekilas Info!</h4>
  Banyak fasilitas Docker yang bergantung pada kernel sistem operasi <em>host</em>.  Sebagai contoh, menggunakan nama <em>service</em> untuk mewakili IP address sebenarnya dicapai oleh Docker dengan menambahkan baris baru pada file <code>/etc/hosts</code>.  Fasilitas ini adalah bawaan sistem operasi untuk memberikan nama alias pada alamat IP.  Begitu juga dengan isolasi komunikasi jaringan yang dicapai melalui bantuan <code>iptables</code> dan pengaturan <code>route</code>.  Ini adalah alasan mengapa Docker jauh lebih cepat dan ringan bila dibandingkan dengan <em>virtual machine</em>.  Alasan yang sama juga membuat isolasi Docker tidak seaman <em>virtual machine</em> dan kenapa Docker tidak bisa mensimulasikan sistem operasi dan arsitektur mesin yang berbeda seperti di <em>virtual machine</em>.
</div>

Di `project1`, saya juga menambahkan klausa `depends_on`.  Ini berarti *container* `project1` tergantung pada `db`. Walaupun demikian, Docker Compose hanya bisa memastikan sampai pada `db` dijalankan sebelum `project1`.  Tentu saja pada saat `db` dijalankan, ada beberapa proses inisialisai dan pekerjaan sejenisnya yang perlu dilakukan.  Docker Compose **tidak** bisa memastikan bahwa MySQL sudah benar-benar siap dipakai oleh `project1`.  Ini adalah tanggung jawab dari kode program di `project1` itu sendiri, misalnya ia harus bisa menunggu atau mengulangi lagi *request* bila `db` masih belum siap untuk dipakai.

Selanjutnya, saya akan menambahkan *service* yang mewakili emulator Datastore dan Pub/Sub.  Untuk itu, saya menambahkan beberapa baris berikut ini pada `docker-compose.yml`:

```yml
version: '3'
services:
  # ...
  # baris sebelumnya diabaikan
  # ...
  datastore:
    image: google/cloud-sdk
    command: gcloud beta emulators datastore start --no-store-on-disk --host-port "0.0.0.0:8081"
    expose:
      - "8081"
    environment:
      CLOUDSDK_CORE_PROJECT: proyek_saya
  pubsub:
    image: google/cloud-sdk
    command: gcloud beta emulators pubsub start --host-port "0.0.0.0:8085"
    expose:
      - "8085"
    environment:
      CLOUDSDK_CORE_PROJECT: proyek_saya
```

Untuk *service* `datastore` dan `pubsub`, saya menggunakan image `google/cloud-sdk` yang sama.  Yang berbeda adalah saya menggunakan `command` untuk mengerjakan perintah yang biasanya saya gunakan untuk menjalankan emulator.  Selain itu, saya menambahkan `expose` supaya port yang ditentukan bisa diakses oleh *service* yang lain.  Berbeda dengan `ports`, port di `expose` tidak bisa diakses oleh komputer *host*.  Mengapa saya tidak menambahkan `expose` pada service `db`? Karena klausa `expose` sudah tertulis di Dockerfile yang dipakai untuk membuat *image* MySQL seperti yang terlihat di <https://github.com/docker-library/mysql/blob/master/5.7/Dockerfile>.

Sebagai langkah terakhir, saya menambahkan *service* untuk emulator Google Cloud Functions.  Untuk itu, saya menambahkan baris berikut ini pada `docker-compose.yml`:

```yml
version: '3'
services:
  # ...
  # baris sebelumnya diabaikan
  # ...
  project2:
    build: ./project2
    depends_on:
      - pubsub
      - datastore
    environment:
      PUBSUB_EMULATOR_HOST: "pubsub:8085"
      PUBSUB_PROJECT_ID: proyek_saya
      DATASTORE_EMULATOR_HOST: "datastore:8081"
      DATASTORE_PROJECT_ID: proyek_saya
```

Tidak ada yang spesial pada definisi *service* di atas.  *Environment variable* seperti `PUBSUB_EMULATOR_HOST` dan `DATASTORE_EMULATOR_HOST` adalah variabel standar yang dipakai untuk merujuk ke lokasi emulator.

Berikut ini adalah isi `Dockerfile` di folder `project2`:

```dockerfile
FROM node:6
ENV GCLOUD_PROJECT=proyek_saya
RUN yarn global add @google-cloud/functions-emulator
COPY . /functions
WORKDIR /functions
RUN yarn
RUN functions config set bindHost 0.0.0.0 && \
  functions config set host 0.0.0.0 && \
  functions start && \
  functions deploy function1 --trigger-http && \
  functions deploy trigger1 --trigger-topic=topic1 && \
  functions deploy trigger2 --trigger-topic=topic2
EXPOSE 8081
CMD functions start && yarn run bridge
```

Karena emulator lokal untuk Google Cloud Functions (<https://github.com/GoogleCloudPlatform/cloud-functions-emulator>) adalah sebuah proyek Node.js, saya menggunakan `node` sebagai *base image*.  Pada saat tulisan ini dibuat, emulator lokal tersebut hanya mendukung sampai Node 6 dan **tidak** mendukung Node 8.  Oleh sebab itu, saya menggunakan tag `6` pada `node:6`.  Tanpa Docker, perbedaan versi Node seperti ini bisa jadi cukup menyebalkan bila saya perlu menjalankan proyek lain yang membutuhkan versi Node berbeda pada saat **bersamaan**.

Proses deployment *functions* ke emulator lokal sebenarnya bisa diletakkan ke dalam sebuah Bash script.  Untuk alasan studi kasus yang terbatas di artikel ini, saya akan mengabaikannya.  Selain itu, untuk saat ini, emulator lokal tidak bisa secara otomatis memicu Cloud Function pada saat *message* di-*push* ke topic Pub/Sub.  Saya terpaksa menulis *script* sederhana untuk mengatasinya, yang kemudian saya jalankan dengan perintah `yarn run bridge`.

Setelah semuanya siap, sekarang adalah saatnya untuk menjalankan Docker Compose.  Saya cukup memberikan perintah berikut ini pada folder yang berisi file `docker-compose.yml`:

> $ <strong>docker-compose up</strong>

Bila ini adalah pertama kalinya saya menjalankan perintah, Docker akan men-*download* beberapa *image* seperti MySQL dan Node.js dari Docker Hub sehingga saya harus sabar menunggu.  Setelah proses *building* selesai, saya bisa melihat log dari Spring Boot yang muncul di *console*.  Saya pun bisa mencoba aplikasi dengan membuka URL <http://localhost:8080> di komputer host untuk memastikannya.

Untuk melihat informasi *service* yang berjalan, saya bisa memberikan perintah berikut ini:

> $ <strong>docker-compose ps</strong>

```
       Name                     Command               State           Ports         
------------------------------------------------------------------------------------
dev_project1_1          /bin/sh -c mvn -DskipTests ...   Up      0.0.0.0:8080->8080/tcp
dev_datastore_1         gcloud beta emulators data ...   Up      8081/tcp              
dev_db_1                docker-entrypoint.sh mysqld      Up      3306/tcp, 33060/tcp   
dev_project2_1          /bin/sh -c functions start ...   Up      8081/tcp              
dev_pubsub_1            gcloud beta emulators pubs ...   Up      8085/tcp              

```

Perintah di atas memperlihatkan daftar *instance* yang sedang berjalan.  Selain itu, ia juga menunjukkan bahwa port `8080` adalah satu-satunya port yang bisa diakses oleh komputer *host*.

Sekarang, untuk menjalankan aplikasi, seseorang hanya perlu men-install Docker, Docker Compose dan menjalankan perintah `docker-compose up`.  Ini jauh lebih mudah dilakukan bila dibandingkan harus membaca instruksi *manual* dan mempraktekkannya satu per satu.

Kesimpulan: App Engine adalah *platform* dimana pengguna cukup menulis kode program dan tidak perlu mengkhawatirkan infrastruktur aplikasi.  Docker atau teknologi sejenisnya tidak dibutuhkan untuk menjalankan App Engine.  Idealnya, programmer harus memiliki replikasi proyek secara online di App Engine untuk setiap *environment* seperti *dev*, *staging* dan *production* sehingga programmer tidak perlu menjalankan emulator lokal sama sekali.  Akan tetapi pada kasus tertentu ini tidak dapat dicapai, misalnya karena alasan biaya bila menggunakan layanan seperti Google Cloud SQL yang mensyaratkan *billing account*.  Bila sudah demikian, Docker sangat membantu dalam menyederhanakan proses mengatur dan  menjalankan berbagai emulator lokal yang dibutuhkan.