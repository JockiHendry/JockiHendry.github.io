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

Hasil `iostat` di atas tidak menunjukkan aktifitas I/O yang sibuk.  Penggunaan HDD hanya 31,3% saja.

Kinerja yang diukur oleh `iostat` berhubungan dengan I/O scheduler di sistem operasi.  Setiap permintaan tulis dan baca tidak langsung di-*kirim* ke HDD melainkan ditampung dulu ke *queue*.  Mengapa demikian?  Karena HDD melibatkan sebuah *head* mekanis yang harus berpindah-pindah ke posisi yang ditentukan, semakin acak lokasi baca dan tulis, semakin sering juga waktu habis untuk perpindahan *head*.  I/O scheduler di sistem operasi akan melakukan operasi baca dan tulis ke HDD yang meminimalkan pergerakan *head*.  Selain itu, I/O scheduler juga bisa memberikan prioritas yang lebih tinggi pada pada *process* tertentu.

Karena tidak ada satu Ubuntu menyediakan beberapa pilihan I/O scheduler.Untuk melihat I/O scheduler yang sedang aktif di Ubuntu, saya bisa memberikan perintah berikut ini:

> $ <strong>cat /sys/block/sda/queue/scheduler</strong>

```
noop deadline [cfq]
```

Pada hasil di atas, terlihat bahwa sistem operasi menyediakan pilihan I/O scheduler berupa `noop`, `deadline` dan `cfg`.  Yang sedang aktif adalah `cfg`.  Pada kernel yang terbaru yang menggunakan *multi queue*, saya akan menemukan pilihan seperti `none` dan `mq-deadline`.

Untuk mengubah I/O scheduler yang sedang aktif, saya bisa memberikan perintah seperti:

> $ <strong>echo deadline | sudo tee /sys/block/sda/queue/scheduler</strong>

Perintah di atas akan mengubah I/O scheduler yang aktif dari `cfg` menjadi `deadline`.  Untuk mengukur efek dari pengaturan yang saya lakukan, tidak cara yang lebih baik selain mencoba menggunakan sistem operasi tersebut sehari-hari.  Ada beberapa hal yang tidak cukup ditunjukkan dengan angka.  Sebagai contoh, saat saya mencoba mengganti penggunaan I/O scheduler dari `mq-deadline` menjadi `none`, saya menemukan bahwa kecepatan meningkat secara drastis di aplikasi *benchmark*.  Akan tetapi, efek sampingnya adalah aplikasi terasi menjadi lebih sering diam menunggu.

Salah satu fitur yang paling sering dimatikan untuk peningkatan Disk I/O adalah *access time update* yang dipakai oleh *ext4 file system*.   Fitur ini akan memperbaharui nilai *last access* pada saat *file* dibaca, walaupun tidak ada perubahan pada isi *file*.  Karena IDE dan *development server* sering membaca *file* di direktori untuk mendeteksi perubahan, secara tidak langsung *access time update* menyebabkan permintaan tulis yang besar (untuk memperbaharui metadata waktu baca terakhir).  Tentu saja efek ini tidak diharapkan!

Untuk mematikan fitur *access time update* di ext4, saya akan mengubah file `/etc/fstab` dan menambahkan pengaturan `noatime` di HDD yang saya pakai, seperti yang terlihat di baris berikut ini:

>
<pre>
UUID=xxx /               ext4    errors=remount-ro,<strong>noatime</strong> 0       1
</pre>
>

Pengaturan lain yang sering direkomendasikan adalah `commit`.  Nilai *default* 5 detik menunjukkan bahwa terjadi *full sync* dari seluruh data di memori ke HDD setiap 5 detik.  Dengan mengubah nilai ini menjadi lebih besar, Linux akan lebih jarang menulis ke HDD sehingga kinerja akan terasa lebih cepat.  Sebagai gantinya, bila terjadi kerusakan dan pemadaman listrik tak terduga, maka data selama nilai `commit` terakhir akan hilang selamanya.  Ini adalah contoh mengorbankan konsistensi demi kinerja.  Saya bisa mengatur nilai `commit` dengan menambahkannya di `/etc/fstab` seperti yang terlihat pada baris berikut ini:

>
<pre>
UUID=xxx /               ext4    errors=remount-ro,noatime,<strong>commit=30</strong> 0       1
</pre>
>

Setelah melihat I/O scheduler dan *file system* yang merupakan pengaturan di sisi sistem operasi, kali ini saya akan mencoba melihat pengaturan yang berhubungan dengan perangkat HDD itu sendiri. Tool `hdparm` akan sangat berguna disini.  Sebagai contoh, saya bisa melihat kecepatan baca HDD secara langsung (mengabaikan *page cache*) dengan menggunakan perintah seperti berikut ini:

> $ <strong>sudo hdparm -t --direct /dev/sda</strong>

```
/dev/sda:
 Timing O_DIRECT disk reads: 360 MB in  3.01 seconds = 119.68 MB/sec
```

Untuk melihat kecepatan tulis HDD, saya bisa mencoba menggunakan perintah `dd` seperti berikut ini:


> $ <strong>dd if=/dev/zero of=test.img bs=1G count=1 oflag=dsync</strong>

```
1+0 records in
1+0 records out
1073741824 bytes (1,1 GB, 1,0 GiB) copied, 11,1324 s, 96,5 MB/s
```

Pada hasil di atas, terlihat bahwa kecepatan tulis di HDD yang saya pakai adalah 96,5 MB/s.  Untuk meningkatkan kinerja tulis, saya perlu memastikan bahwa fitur *write caching* di HDD aktif.  Berbeda dengan *page cache* dari sistem operasi, HDD juga memiliki *cache* internal di dalam perangkatnya.  Secara default, fasilitas ini selalu aktif.  Akan tetapi, bila belum aktif, saya juga bisa mengaktifkannya dengan memberikan perintah seperti berikut ini:

> $ <strong>sudo hdparm -W1 /dev/sda</strong>

```
/dev/sda:
 setting drive write-caching to 1 (on)
 write-caching =  1 (on)
```