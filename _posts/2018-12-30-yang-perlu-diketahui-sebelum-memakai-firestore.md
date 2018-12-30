---
layout: post
category: Pemograman
title: Hal Yang Perlu Diketahui Sebelum Memakai Google Cloud Firestore
tags: [Firebase, Firestore]
---

Salah satu alasan utama saya melirik database *serverless* seperti Firestore adalah biaya.  Harga sebuah *droplet* di Digital Ocean paling murah adalah $5 per bulan.  Sementara dengan Firestore, pada proyek prototype dan sederhana, saya tidak perlu membayar bila aplikasi tidak digunakan.  Setelah puas menerapkan Firestore pada aplikasi sederhana, saya pun mencoba menggunakannya untuk sesuatu yang lebih serius seperti aplikasi bisnis.  Seperti biasa, semua tidak pernah semulus apa yang saya bayangkan.  Berikut ini adalah beberapa hal yang saya berharap sudah saya ketahui sebelum memutuskan untuk menggunakan Firestore pada sesuatu yang lebih serius:

#### *Import* data lama membutuhkan biaya besar

Hal ini cukup masuk akal karena *billing* Firestore berdasarkan pengunaan.  Bayangkan berapa banyak operasi tulis yang terjadi bila saya memindahkan data 5 tahun dari database lama ke Firestore.

#### Firestore tidak mendukung *aggregation*

Ini berarti saya tidak bisa melakukan query yang melibatkan *aggregation* seperti `SUM` dan `AVG` di MySQL.  Sebagai alternatifnya, saya harus menyimpan nilai agregasi dan memperbaharuinya secara manual, misalnya seperti pada contoh program di <https://firebase.google.com/docs/firestore/solutions/aggregation>.  Sebenarnya ini bukanlah hal yang buruk pada aplikasi yang lebih banyak memiliki operasi baca ketimbang operasi tulis.  Dengan menyimpan hasil agregasi secara manual di sebuah *property*, operasi baca bisa dilakukan dengan cepat.

Untuk memperbaharui nilai agregasi, saya harus berhati-hati karena operasi ini harus *atomic*.  Bayangkan pada contoh dimana saya harus memperbaharui nilai `total` seperti berikut ini:

1.  <span style="color: green;">Operasi 1: ====== Baca nilai `total` yang sudah ada (`total = 10`)</span>.
1.  <span style="color: blue;">Operasi 2: ==================== Baca nilai `total` yang sudah ada (`total = 10`)</span>.
1.  <span style="color: blue;">Operasi 2: ==================== Baca nilai `delta` yang baru (`total = 10` dan `delta = 2`)</span>.
1.  <span style="color: blue;">Operasi 2: ==================== Perbaharui nilai `total += delta` (`total = 12`)</span>.
1.  <span style="color: green;">Operasi 1: ====== Baca nilai `delta` yang baru (`total = 10` dan `delta = 5`)</span>.
1.  <span style="color: green;">Operasi 1: ====== Perbaharu nilai `total += delta` (`total = 15`)</span>.

Pada contoh di atas, operasi 1 dan operasi 2 berlangsung hampir bersamaan.  Hasil akhirnya adalah nilai `total = 15` padahal seharusnya `total = 17`.  Hal ini terjadi karena selama operasi 1 berlangsung, sebenarnya nilai `total` sudah diperbaharui oleh operasi 2 tetapi tidak diketahui oleh operasi 1.  Untuk mengatasi hal seperti ini, saya bisa menggunakan fitur *transaction* di Firestore.  Sebuah *transaction* di Firestore harus diawali dengan operasi `get()` yang kemudian diikuti oleh operasi tulis seperti `set()`, `update()` dan `delete()`.  Bila seandainya terdapat perubahan selama *transaction* dikerjakan, Firestore akan mengulangi seluruh operasi di *transaction*.

#### Sebuah *document* tunggal hanya boleh diperbaharui sekali per detik

Bila saya menggunakan metode agregasi secara manual dan perubahan agregasi tersebut ternyata perlu dilakukan lebih dari puluhan kali dalam satu detik, saya akan menemukan pesan kesalahan `"Error: 10 ABORTED: Too much contention on these documents. Please try again."`.  Salah satu solusi untuk mengatasi ini adalah dengan menerapkan *'sharding'* pada nilai yang di-agregasi seperti pada contoh kode program di <https://firebase.google.com/docs/firestore/solutions/counters>.  Tapi ini membuat kode program lebih rumit dan mengurangi kinerja baca.  Kesimpulannya: Bila aplikasi memiliki operasi tulis dengan intensitas tinggi dan melibatkan banyak agregasi, sebaiknya tidak menggunakan Firestore sebagai database.

#### Cloud Functions bisa saja dikerjakan lebih dari sekali untuk trigger yang sama

Firestore memiliki konsep *trigger* dimana kode program Cloud Functions bisa dikerjakan setiap kali dokumen dibuat, diubah, dan/atau dihapus.  Bagian penting yang perlu diketahui (setidaknya selama Firestore masih *beta* saat ini) adalah sebuah *event* tunggal dapat menyebabkan Cloud Functions yang sama dikerjakan beberapa kali.  Sebenarnya hal ini bukan hanya terjadi di Firestore, tetapi juga Cloud PubSub secara keseluruhan.  Itu sebabnya sangat penting untuk membuat *function* yang bersifat *idempotent*.  Pemanggilan *function* dengan *parameter* yang sama harus menghasilkan *output* yang sama.  Sebuah *function* yang bersifat *idempotent* tidak akan membuat dua dokumen berbeda bila dipanggil dengan parameter yang sama sebanyak dua kali.  Dengan demikian, ia aman dipakai sebagai *trigger*.

Walaupun demikian, terdapat kasus dimana membuat *function* yang *idempotent* menjadi lebih susah.  Contohnya adalah *function* yang mengirim email melalui Mailgun setiap kali *document* dihapus.  Tanpa menyimpan *context.eventId* terlebih dahulu, akan sulit bagi saya untuk menghindari mengirim email yang sama lebih dari sekali bila Firestore mengerjakan *function* lebih dari sekali untuk sebuah penghapusan yang sama.

#### Menghapus *collection* tidak termasuk *subcollections*

Pada Firestore, sebuah *collection* terdiri atas satu atau beberapa *document*.  Selanjutnya, sebuah *document* dapat mengandung satu atau beberapa *collection*.  Ini memungkinkan hierarki *subcollection*.  Saat membaca *document*, nilai *subcollection* tidak akan ikut dibaca.  Ini sangat berguna untuk meningkatkan kinerja baca.  Sebagai alternatif *subcollection*, saya juga bisa menggunakan *nested objects* dengan meletakkan isi *subcollection* tersebut ke dalam *document* sebagai *array*.  *Nested object* akan ikut dibaca sebagai bagian dari *document* dan jumlahnya terbatas.

Saat mengerjakan *unit test*, biasanya saya akan mengisi *document* beserta *subcollection*-nya.  Begitu pengujian selesai, saya perlu membersihkan database.  Ternyata, menghapus sebuah *document* tunggal memang mudah, tapi *subcollection*-nya masing-masing perlu dicari dan dihapus secara manual.  Contoh kode program untuk melakukan penghapusan secara *'rekursif'* tersebut dapat dilihat di <https://firebase.google.com/docs/firestore/solutions/delete-collections>.