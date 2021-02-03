---
layout: post
category: Pemograman
title: Menggunakan Array Di Google BigQuery
tags: [BigQuery, GoogleCloudPlatform]
---

Salah satu cara untuk mendapatkan hasil query lebih cepat di BigQuery adalah dengan melakukan denormalisasi dengan menggunakan tipe data `ARRAY`. 
Sebagai contoh, saya akan membuat sebuah tabel baru bernama `faktur` dengan struktur seperti berikut ini:

![Struktur Tabel]({{ "/assets/images/gambar_00047.png" | relative_url}}){:class="img-fluid rounded"} 

Pada tabel di atas, field `items` adalah sebuah array yang terdiri atas satu atau lebih *record*.  Tipe data dari `items` adalah `STRUCT` (`RECORD`) 
sehingga `items` menyerupai sebuah tabel yang berada di dalam tabel `faktur`.

Saya bisa menambahkan beberapa data baru dengan menggunakan perintah SQL berikut ini:

```sql
INSERT INTO faktur VALUES ('F-001','2020-07-11 07:00:00', [
   ('P-001', 10, NUMERIC '5000.00'), ('P-002', 20, NUMERIC '4000.00'), ('P-003', 5, NUMERIC '15000.00')
]);

INSERT INTO faktur VALUES ('F-002','2020-07-11 08:00:00', [
   ('P-002', 99, NUMERIC '3900.00')
]);

INSERT INTO faktur VALUES ('F-003','2020-07-11 09:00:00', [
   ('P-001', 1, NUMERIC '6000.00'), ('P-001', 2, NUMERIC '6000.00'), ('P-002', 1, NUMERIC '5000.00')
]);

INSERT INTO faktur VALUES ('F-004','2020-07-11 09:00:00', [
   ('P-003', 88, NUMERIC '10000.00')
]);
```

Untuk menyisipkan sebuah array, saya menggunakan kurung siku seperti `[1,2,3,4,5]`.  Karena array tersebut memiliki tipe `STRUCT`, saya menggunakan tanda kurung
untuk menyisipkan field sesuai dengan deklarasi `STRUCT` tersebut.  Hasil DML di atas akan terlihat seperti berikut ini:

![Isi Tabel]({{ "/assets/images/gambar_00048.png" | relative_url}}){:class="img-fluid rounded"}

Salah satu operator yang paling sering dipakai bersama dengan array adalah `UNNEST`.  Operator ini digunakan untuk melakukan *flattening* array sehingga 
setiap *item* di array akan menjadi sebuah *record*.  Sebagai contoh, untuk menerjemahkan setiap elemen array kolom `items` menjadi *record* terpisah, saya bisa
menggunakan query seperti berikut ini:

```sql
SELECT items.kodeProduk, items.jumlah, items.harga
FROM faktur
CROSS JOIN UNNEST(faktur.items) AS items;
```

kodeProduk   | jumlah | harga |
-------------|-------:|------:|
 P-002       |     99 |  3900 |
 P-001       |     10 |  5000 |
 P-002       |     20 |  4000 |
 P-003       |      5 | 15000 |
 P-003       |     88 | 10000 |
 P-001       |      1 |  6000 |
 P-001       |      2 |  6000 |
 P-002       |      1 |  5000 |

<br/>

Dengan demikian, saya bisa mendapatkan informasi seperti produk yang paling banyak dibeli dengan menggunakan query seperti:

```sql
SELECT items.kodeProduk, SUM(items.jumlah) AS jumlah
FROM faktur
CROSS JOIN UNNEST(faktur.items) AS items
GROUP BY items.kodeProduk
ORDER BY jumlah DESC;
```

kodeProduk   | jumlah |
-------------|-------:|
 P-002       |    120 |
 P-003       |     93 | 
 P-001       |     13 | 

<br/>

Bagaimana bila saya ingin mendapatkan daftar item beserta dengan jumlah yang harus dibayar untuk setiap faktur?  Saya bisa menggunakan query berikut ini:

```sql
SELECT faktur.nomor, faktur.items, 
  (SELECT SUM(item.jumlah * item.harga) FROM UNNEST(faktur.items) item) AS total,  
FROM faktur 
```

  nomor |                                                                             items                                                                             | total  |
------- |--------------------------------------------------------------------------------------------------------------------------------------------------------------:|-------:|
  F-001 | [{"kodeProduk":"P-001","jumlah":"10","harga":"5000"},{"kodeProduk":"P-002","jumlah":"20","harga":"4000"},{"kodeProduk":"P-003","jumlah":"5","harga":"15000"}] | 205000 |
  F-003 |    [{"kodeProduk":"P-001","jumlah":"1","harga":"6000"},{"kodeProduk":"P-001","jumlah":"2","harga":"6000"},{"kodeProduk":"P-002","jumlah":"1","harga":"5000"}] |  23000 |
  F-002 |                                                                                                         [{"kodeProduk":"P-002","jumlah":"99","harga":"3900"}] | 386100 |
  F-004 |                                                                                                        [{"kodeProduk":"P-003","jumlah":"88","harga":"10000"}] | 880000 |

<br/>

Setelah mendapatkan hasil di atas, saya juga bisa melakukan penyaringan lebih lanjut lagi dengan menggunakan `WHERE`.  Sebagai contoh, query berikut ini akan memberikan
hasil dengan struktur yang sama tetapi hanya untuk faktur yang mengandung `kodeProduk` dengan nilai `P-003` saja:

```sql
SELECT faktur.nomor, faktur.items,
  (SELECT SUM(item.jumlah * item.harga) FROM UNNEST(faktur.items) item) AS total,  
FROM faktur 
WHERE EXISTS (SELECT 1 FROM UNNEST(faktur.items) AS item WHERE item.kodeProduk = 'P-003');
```

  nomor |                                                                             items                                                                             | total  |
--------|--------------------------------------------------------------------------------------------------------------------------------------------------------------:|-------:|
  F-001 | [{"kodeProduk":"P-001","jumlah":"10","harga":"5000"},{"kodeProduk":"P-002","jumlah":"20","harga":"4000"},{"kodeProduk":"P-003","jumlah":"5","harga":"15000"}] | 205000 |
  F-004 |                                                                                                        [{"kodeProduk":"P-003","jumlah":"88","harga":"10000"}] | 880000 |

<br/>

Pada kondisi tertentu, saya tidak membutuhkan seluruh detail di kolom `items`.  Bagaimana bila saya hanya ingin mengetahui produk apa saja yang 
tertera dalam faktur?  Untuk mengubah array menjadi teks, saya bisa menggunakan function `ARRAY_TO_STRING` seperti pada contoh berikut ini:

```sql
SELECT faktur.nomor, 
  ARRAY_TO_STRING(ARRAY(SELECT DISTINCT item.kodeProduk FROM UNNEST(faktur.items) item), ', ') AS daftarProduk
FROM faktur
```

 nomor |    daftarProduk     |
-------|---------------------|
 F-001 | P-001, P-002, P-003 |
 F-002 | P-002               |
 F-003 | P-001, P-002        |
 F-004 | P-003               |
