---
layout: post
category: DevOps
title: Mengoptimalkan MySQL untuk integration testing
tags: [MySQL]
---

Pada saat pertama kali bekerja di dunia IT dan mempelajari Oracle Database, saya mendapatkan nasehat: *"Tidak ada satu database tunggal yang bekerja dengan baik di semua jenis aplikasi.  Untuk itu, database perlu dioptimalkan oleh database administrator."*  Sekarang, setelah lebih banyak bekerja di *startup*, saya jarang sekali menemukan peran *database administrator* lagi!  Hal ini karena *startup* lebih berfokus pada membuat sebuah aplikasi seminimal mungkin (*minimum viable product*) dan segala sesuatu yang berada di *cloud* membuat programmer memiliki pola pikir *'tinggal pakai saja'*.

Walaupun demikian, nasehat lama tersebut tetap berlaku.  Setiap server MySQL yang dipakai untuk keperluan berbeda akan memiliki konfigurasi optimal yang berbeda.  Sebagai contoh, database MySQL yang dipakai untuk produksi tentunya memiliki konfigurasi yang dioptimalkan untuk transaksi dan konsistensi database.  Hal ini justru terbalik dengan database MySQL yang dipakai untuk keperluan *integration testing* dimana reliabilitas boleh dikorbankan demi kecepatan.  Selain itu, jumlah data yang terlibat di *integration testing* juga jauh lebih sedikit dibandingkan dengan database produksi.

Menunggu lama untuk hasil *integration testing* merupakan sesuatu yang membosankan.  Programmer mana yang mau menunggu hasil pengujian selama setengah jam, lalu bila terjadi kesalahan, memperbaiki kode program, dan kemudian menunggu setengah jam lagi untuk melihat keberhasilannya?  Hal ini saya alami sendiri!  Pada sebuah *integration testing* lokal yang memakai MySQL Server 5.7, saya harus menunggu sekitar 10 menit untuk mendapatkan hasil pengujian.  Mungkin pengetahuan *database administration* yang dulu saya pelajari bisa saya terapkan disini.  Oleh sebab itu, hari ini saya akan mencoba melakukan pengaturan pada server MySQL 5.7 tersebut.  Tentu saja pengaturan ini hanya untuk server *integration testing* dan bukan produksi!

Langkah pertama yang saya lakukan adalah melihat membuka MySQL Workbench dan memilih **Performance**, **Dashboard** untuk melihat **Performance Dashboard** seperti:

![Tampilan Performance Dashboard di MySQL Workbench]({{ "/assets/images/gambar_00019.png" | relative_url}}){:class="img-fluid rounded"}

Pada database produksi, bagian **InnoDB Buffer Pool** adalah yang pertama kali saya lihat bila terdapat keluhan database lambat.  Namun pada *integration testing*, jumlah *record* yang ada cukup minimal sehingga *buffer pool* terlihat tidak penuh.  Pada gambar di atas, *buffer pool* yang terpakai hanya 59%.  Lalu mengapa database lambat?  

Salah satu alasan sebuah database menjadi lambat adalah banyaknya operasi baca tulis ke hard disk.  Idealnya, bila semua yang dibutuhkan oleh database ada di memori, maka tidak perlu ada yang ditulis ke hard disk.  Pada grafis **InnoDB Disk Writes**, saya bisa menemukan cukup banyak aktifitas menulis ke file. Namun tidak ada informasi lebih lanjut dari grafis.  Agar lebih spesifik, saya membuka menu **Performance Reports** dan memilih **Hot Spots for I/O**, **Top I/O by File by Time**.  Pada tabel yang muncul, saya menemukan bahwa 45% dari waktu eksekusi 10 menit dihabiskan untuk melakukan operasi baca tulis ke file `/var/lib/mysql/ib_logfile0`.

Apa fungsi file `ib_logfile0` tersebut?  File seperti `ib_logfile0` dan `ib_logfile1` adalah apa yang disebut sebagai *redo logs* di MySQL.  Bila pada saat mengerjakan beberapa query dalam sebuah *transaction*, tiba-tiba server MySQL mati mendadak, maka pada saat MySQL dinyalakan kembali, ia akan membaca isi file *redo logs* yang ada dan memastikan bahwa perubahan yang belum di-*commit* akan dibatalkan.  Dengan demikian isi database tetap konsisten walaupun terdapat gangguan pada server database.  Pertanyaannya: apakah saya butuh fitur ini pada saat melakukan *integration testing*?  Tentu saja tidak! Ini malah memperlambat pengujian.

MySQL tidak langsung menulis ke file `ib_logfile0` begitu ada perubahan di *transaction*.  Ia akan menampung perubahan terlebih dahulu ke dalam area memori yang disebut sebagai *log buffer*.  Secara logika, bila *log buffer* ini memiliki ukuran yang cukup besar untuk menampung seluruh perubahan database selama pengujian, maka MySQL tidak perlu menulis apa-apa ke file `ib_logfile0`.  Hal ini karena pada kode pengujian saya, *transaction* akan segera di-*rollback* setiap kali masing-masing *test method* selesai dikerjakan.

Untuk meningkatkan *log buffer*, saya bisa menambahkan pengaturan berikut ini pada file konfigurasi MySQL:

```
innodb_buffer_pool_size = 512M
innodb_log_file_size = 512M
innodb_log_buffer_size = 512M
```

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Pada sistem operasi Ubuntu, file konfigurasi MySQL 5.7 terletak di lokasi <code class="higlighter-rouge">/etc/mysql/mysql.conf.d/mysqld.cnf</code>.
</div>

Dengan ukuran *log buffer* (`innodb_log_buffer_size`) yang hampir sama dengan *buffer pool* (`innodb_buffer_pool_size`) dan *redo logs* (`innodb_log_file_size`), harusnya selama *buffer pool* tidak penuh, maka tidak ada aktifitas penulisan ke *redo log*, bukan?  Sayangnya, hasilnya ternyata tidak seperti yang saya duga!  Saya masih menjumpai banyak aktifitas IO yang sangat memperlambat pengujian.

Mengapa demikian?  Apakah mungkin karena *double writing*?  Secara default, MySQL akan menulis perubahan database dua kali.  Pertama, penulisan dilakukan ke wilayah yang disebut *doublewrite buffer*.  Setelah proses *flushing*, isi di *doublewrite buffer* akan dipindahkan ke file database yang mewakili isi tabel dan *index* (file yang berakhiran `.ibd` dan `.ibdata`).  Saya bisa mematikan *double writing* dengan menambahkan baris berikut ini pada file konfigurasi MySQL:

```
innodb_doublewrite = OFF
```

Setelah menjalankan ulang server MySQL, saya menemukan hasil yang cukup memuaskan.  Pengujian yang memakan waktu 10 menit berkurang menjadi 7 menit.  Walaupun demikian, masih ada sekitar 37% waktu terpakai habis untuk melakukan penulisan ke *redo logs*.

Mungkinkah saya bisa mendapatkan kinerja yang lebih baik bila saya mengurangi operasi *flush*? Untuk mengurangi flush maka melakukan pengaturan berikut ini:

```
innodb_flush_log_at_timeout = 2000
innodb_flush_log_at_trx_commit = 2
```

Nilai `innodb_flush_log_at_trx_commit` berupa `2` menyebabkan MySQL menulis perubahan ke file hanya sekali per detik. Bandingkan dengan nilai default `1` dimana MySQL menulis perubahan ke file langsung ketika *commit* terjadi.  Bila terdapat puluhan operasi *commit* dalam satu detik, maka akan ada penulisan puluhan kali sesuai dengan jumlah *commit* tersebut.  Ini memang lebih ACID, tapi tidak dibutuhkan pada kasus saya.

Selain itu, saya ingat bahwa saya menggunakan hard disk lama yang lambat untuk pengujian.  Nilai `innodb_io_capacity` merupakan batas atas jumlah operasi I/O yang boleh dilakukan setiap detiknya.  Secara default, nilai yang dipakai di MySQL 5.7 adalah `200` operasi I/O per detik.  Berdasarkan isi dokumentasi, nilai `200` adalah nilai untuk hard disk SSD *low-end*.  Saya akan mencoba menguranginya menjadi `100` setelah mempertimbangkan hard disk yang saya pakai dengan menambahkan konfigurasi berikut ini:

```
innodb_io_capacity = 100
innodb_io_capacity_max = 200
innodb_flush_sync = OFF
```

Pada konfigurasi di atas, saya juga mematikan `innodb_flush_sync` supaya nilai `innodb_io_capacity` tidak diabaikan bila terjadi kesibukan tak terduga.

Setelah menambahkan konfigurasi baru, *integration test* kini memakan waktu sekitar 6 menit.  Hanya lebih cepat 1 menit dari semula!  Pasti masih ada yang bisa saya lakukan untuk meningkatkan kecepatan pengujian!

Mungkin saya bisa menemukan petunjuk berharga dengan melihat apa saja SQL yang lambat selama 7 menit tersebut.  Untuk itu, saya memilih menu **User Resource Usage**, **Statement Statistics** di MySQL Workbench.  Setelah mengurutkan tabel yang muncul berdasarkan waktu eksekusi, saya menemukan bahwa jenis perintah seperti `alter_table`, `create_table` dan `create_index` menghabiskan waktu paling lama.  Hal ini cukup masuk akal.  Pada *integration testing* yang saya buat, database akan dikosongkan dan di-isi secara otomatis oleh Flyway setiap kali pengujian dimulai.  Karena saya sudah cukup *agile*, jumlah *migration script* untuk proyek ini sudah hampir mencapai ratusan.  Bayangkan bagaimana MySQL harus bekerja keras menerapkan setiap perubahan yang pernah saya lakukan mulai dari proyek diciptakan pertama kali hingga sekarang.  Masing-masing *migration script* mewakili operasi kecil seperti penambahan field baru di tabel yang sudah ada atau menghapus field dari tabel yang ada; tetapi jumlah operasi DDL yang banyak tersebut sepertinya cukup membuat MySQL 5.7 kewalahan.

Mungkin saya bisa mengurangi I/O dengan mengurangi jumlah file.  Pada MySQL 5.7, parameter `innodb_file_per_table` secara *default* diaktifkan.  Ini membuat perintah seperti `ALTER TABLE` menjadi lambat.  Padahal, untuk sebuah database yang dipakai pengujian, organisasi file per tabel sama sekali tidak berguna; data yang ada toh juga akan segera dihapus setiap kali pengujian dimulai.  Untuk itu, saya segera menambahkan baris berikut ini pada file konfigurasi MySQL yang saya pakai:

```
innodb_file_per_table = OFF
```

Ternyata pengaturan yang terakhir ini memberikan peningkatkan kinerja yang cukup besar.  Proses pengerjaan *integration test* yang tadinya memakan waktu 6 menit kini hanya membutuhkan sekitar 3 menit.  Dengan demikian, secara garis besar, saya berhasil meningkatkan kecepatan *integration test* dari yang membutuhkan 10 menit hingga menjadi 3 menit.  Tidak ada lagi alasan untuk buru-buru *commit* dan mengabaikan *integration test* karena khawatir menunggu lama.