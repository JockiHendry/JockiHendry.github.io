---
layout: post
category: OS
title: Meningkatkan Kinerja Disk I/O Di Ubuntu
tags: [Ubuntu]
---

Saat menggunakan *external HDD* untuk bekerja, saya menemukan bahwa Ubuntu bekerja jauh lebih lambat dibandingkan saat menggunakan *internal HDD*.  Hal ini terutama sangat terasa bila saya menjalankan beberapa IDE sekaligus seperti Webstorm dan IntelliJ IDEA secara bersamaan.  Pada kasus tertentu, sistem operasi menjadi *crash* karena saking sibuknya *external HDD* bekerja.  Hal ini terjadi walaupun saya sudah menggunakan konektor USB 3.0 yang menawarkan kecepatan maksimal hingga 5 Gbit/s.  Mungkin ini disebabkan oleh USB controller yang memang tidak dioptimalkan untuk HDD (bila dibandingkan dengan SATA).  Lalu apa yang bisa saya lakukan untuk mendapatkan kinerja I/O yang lebih baik?

Untuk mengukur kinerja Disk I/O  di sistem operasi Ubuntu tersebut, saya akan menggunakan perintah `iostat` saat saya mensimulasikan bekerja dengan IDE, menjalankan server database dan mengaktifkan `ng serve` untuk *front end*.  Berikut ini adalah hasil yang saya peroleh:

> $ <strong>iostat -xdh /dev/sda</strong>

```
Linux 5.0.0-13-generic 	06/05/19 	_x86_64_	(4 CPU)

     r/s     w/s     rkB/s     wkB/s   rrqm/s   wrqm/s  %rrqm  %wrqm r_await w_await aqu-sz rareq-sz wareq-sz  svctm  %util Device
  139,31   12,54      3,0M    358,4k    53,44    21,81  27,7%  63,5%    9,46    8,86   1,23    22,0k    28,6k   2,06  31,3% sda
```

Berdasarkan *manual* yang ada, masing-masing kolom di hasil `iostat` memiliki makna seperti berikut ini:

* `r/s` adalah jumlah permintaan baca per detik.
* `w/s` adalah jumlah permintaan tulis per detik.
* `rkB/s` adalah besarnya data yang dibaca per detik.
* `wkB/s` adalah besarnya data yang ditulis per detik.
* `rrqm/s` adalah jumlah permintaan baca yang masuk dalam *queue* (antrian dari *scheduler*).
* `wrqm/s` adalah jumlah permintaan tulis yang masuk dalam *queue*.
* `r_await` adalah rata-rata waktu (dalam ms) yang dibutuhkan untuk permintaan baca diproses termasuk waktu saat menunggu di *queue*.
* `w_await` adalah rata-rata waktu (dalam ms) yang dibutuhkan untuk permintaan tulis diproses termasuk waktu saat menunggu di *queue*.
* `aqu-sz` adalah rata-rata ukuran *queue*.
* `rareq-sz` adalah rata-rata ukuran permintaan baca.
* `wareq-sz` adalah rata-rata ukuran permintaan tulis.
* Nilai `svctm` tidak dipergunakan lagi.
* `%util` adalah persentase waktu dimana perangkat HDD ini sibuk.  Semakin besar nilai ini menunjukkan HDD semakin sibuk.

Pada hasil `iostat` yang saya peroleh, nilai `%wrqm` terlihat sangat tinggi!  Padahal, saya baru menjalankan IDE dan beberapa *server*.  Seharusnya tidak banyak operasi tulis yang terjadi.  Hal ini mungkin berhubungan dengan fasilitas *access time update* di *ext4 file system*.  Fitur ini akan memperbaharui nilai *last access* pada saat *file* dibaca, walaupun tidak ada perubahan pada isi *file*.  Karena IDE dan *development server* sering membaca *file* di direktori untuk mendeteksi perubahan, secara tidak langsung *access time update* menyebabkan permintaan tulis yang besar (untuk memperbaharui metadata waktu baca terakhir).  Tentu saja efek ini tidak diharapkan!

Untuk mematikan fitur *access time update* di ext4, saya akan mengubah file `/etc/fstab` dan menambahkan pengaturan `noatime` di HDD yang saya pakai, seperti yang terlihat di baris berikut ini:

>
<pre>
UUID=xxx /               ext4    errors=remount-ro,<strong>noatime</strong> 0       1
</pre>
>

Setelah menjalankan ulang komputer, saya mencoba menjalankan kembali `iostat` setelah mensimulasikan pekerjaan sehari-hari saya.  Kali ini saya memperoleh hasil seperti berikut ini:

> $ <strong>iostat -xdh /dev/sda</strong>

```
Linux 5.0.0-13-generic 	06/05/19 	_x86_64_	(4 CPU)

     r/s     w/s     rkB/s     wkB/s   rrqm/s   wrqm/s  %rrqm  %wrqm r_await w_await aqu-sz rareq-sz wareq-sz  svctm  %util Device
  161,01    9,06      3,5M    453,4k    61,63     7,07  27,7%  43,8%    9,43    9,12   1,37    22,4k    50,0k   2,09  35,6% sda
```

Kali ini nilai `%wrqm` tidak begitu tinggi lagi!  Selain itu, tanpa harus melihat statistik, saya juga bisa merasakan sendiri perubahannya saat bekerja.  IDE terasa lebih reponsif dibandingkan sebelumnya.

Pengaturan lain yang sering direkomendasikan adalah `commit`.  Nilai *default* 5 detik menunjukkan bahwa terjadi *full sync* dari seluruh data di memori ke HDD setiap 5 detik.  Dengan mengubah nilai ini menjadi lebih besar, Linux akan lebih jarang menulis ke HDD sehingga kinerja akan terasa lebih cepat.  Sebagai gantinya, bila terjadi kerusakan dan pemadaman listrik tak terduga, maka data selama nilai `commit` terakhir akan hilang selamanya.  Ini adalah contoh mengorbankan konsistensi demi kinerja.  Saya bisa mengatur nilai `commit` dengan menambahkannya di `/etc/fstab` seperti yang terlihat pada baris berikut ini:

>
<pre>
UUID=xxx /               ext4    errors=remount-ro,noatime,<strong>commit=30</strong> 0       1
</pre>
>

Untuk mengukur efek dari pengaturan yang saya lakukan, tidak cara yang lebih baik selain mencoba menggunakan sistem operasi tersebut sehari-hari.  Ada beberapa hal yang tidak cukup ditunjukkan dengan angka.  Sebagai contoh, saat saya mencoba mengganti penggunaan I/O scheduler dari `mq-deadline` menjadi `none`, saya menemukan bahwa kecepatan meningkat secara drastis di aplikasi *benchmark*.  Akan tetapi, efek sampingnya adalah aplikasi menjadi lebih sering diam menunggu.