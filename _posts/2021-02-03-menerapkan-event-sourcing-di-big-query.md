---
layout: post
category: Pemograman
title: Menerapkan Event Sourcing Di BigQuery
tags: [BigQuery, GoogleCloudPlatform]
---

*Event sourcing* adalah sebuah pola dimana aplikasi menyimpan setiap perubahan yang dilakukan terhadap sebuah entitas (biasanya dalam bentuk 
*event*).  Sebagai contoh, aplikasi bisa saja memiliki *event* seperti `PelangganBaruDaftar`, `DataPelangganBerubah`, dan `PelangganDihapus`.
Setiap kali terjadi aksi di aplikasi, *event* tersebut akan tersimpan di dalam *event store*.  Pola *event sourcing* seperti ini biasanya 
dipadukan bersama *event driven design* dan CQRS.

Walaupun ada banyak kandidat yang lebih baik sebagai *event store*, BigQuery bisa menjadi sebuah cadangan yang bagus.  Database ini dapat memproses
data dalam jumlah besar dan tepat untuk data yang jarang berubah.  Ini sesuai dengan karakteristik *event store* karena *event* yang sudah tersimpan
tidak akan diubah atau dihapus.  Sebagai contoh, saya akan membuat tabel seperti berikut ini sebagai *event store*:

```sql
CREATE TABLE IF NOT EXISTS latihan.event_store (
    nama_event STRING NOT NULL,
    tanggal TIMESTAMP NOT NULL,
    payload STRING NOT NULL,
) PARTITION BY DATE(_PARTITIONTIME);
```

Saya menggunakan *partitioned table* untuk menghemat biaya dan meningkatkan kinerja karena isi dari tabel ini akan sangat besar sekali.  Aplikasi
akan menulis ke tabel ini sepanjang waktu setiap harinya.  Dengan melakukan partisi berdasarkan waktu *record* ditambahkan (`_PARTITIONTIME`), 
saya bisa men-*query* hanya *record* yang berada di partisi hari ini atau bulan ini atau tahun ini saja.  Ini tentu saja akan mengurangi jumlah data 
yang di-*query* (sehingga biaya yang dibebankan akan berkurang) dan meningkatkan kinerja (karena data yang diproses semakin kecil).

Mengapa melakukan partisi dengan menggunakan kolom `_PARTITIONTIME` dan bukan `tanggal`?  Ini hanya masalah selera.  Saya memilih 
menggunakan `_PARTITIONTIME` karena kolom ini termasuk salah satu *pseudo column* yang bisa di-*query* tanpa biaya.  Walaupun demikian,
nilai `_PARTITIONTIME` bisa saja berbeda dengan kolom `tanggal`.  Kolom `_PARTITIONTIME` adalah waktu dimana *record* tersebut ditambahkan dan
tidak dapat di-ubah, sementara `tanggal` adalah nilai yang bisa di-modifikasi secara bebas.

Saya kemudian men-simulasi-kan beberapa *record* yang mewakili *event* dengan memberikan perintah SQL berikut ini:

```sql
INSERT INTO latihan.event_store(nama_event, tanggal, payload) VALUES (
    'PelangganBaruDaftar',
    TIMESTAMP('2021-02-01 08:00:00+07'),
    '{"kodePelanggan": "C1", "nama": "Jocki Hendry", "poin": 0, "kategori": ["vip"]}'
);

INSERT INTO latihan.event_store(nama_event, tanggal, payload) VALUES (
    'PelangganBaruDaftar',
    TIMESTAMP('2021-02-01 09:00:00+07'),
    '{"kodePelanggan": "C2", "nama": "The Solid Snake", "poin": 10, "kategori": ["player"]}'
);

INSERT INTO latihan.event_store(nama_event, tanggal, payload) VALUES (
    'PelangganBaruDaftar',
    TIMESTAMP('2021-02-01 10:00:00+07'),
    '{"kodePelanggan": "C3", "nama": "The Liquid Snake", "poin": 10, "kategori": ["player"]}'
);

INSERT INTO latihan.event_store(nama_event, tanggal, payload) VALUES (
    'DataPelangganBerubah',
    TIMESTAMP('2021-02-01 12:01:00+07'),
    '{"kodePelanggan": "C1", "nama": "Jocki Hendry", "poin": 100, "kategori": ["vip"]}'
);

INSERT INTO latihan.event_store(nama_event, tanggal, payload) VALUES (
    'DataPelangganBerubah',
    TIMESTAMP('2021-02-02 08:00:00+07'),
    '{"kodePelanggan": "C1", "nama": "Jocki Hendry", "poin": 200, "kategori": ["tester", "vip"]}'
);

INSERT INTO latihan.event_store(nama_event, tanggal, payload) VALUES (
    'PelangganDihapus',
    TIMESTAMP('2021-02-03 08:00:00+07'),
    '{"kodePelanggan": "C1", "nama": "Jocki Hendry"}'
);

INSERT INTO latihan.event_store(nama_event, tanggal, payload) VALUES (
    'DataPelangganBerubah',
    TIMESTAMP('2021-02-02 09:00:00+07'),
    '{"kodePelanggan": "C2", "nama": "The Solid Snake", "poin": 10, "kategori": ["player", "vip"]}'
);
```

Salah satu ciri *event store* adalah operasi yang dilakukan hanya `INSERT` saja dengan data yang mirip seperti *audit log*.  Walaupun
data pelanggan berubah, saya tetap mewakilinya dengan SQL `INSERT` yang menambahkan `nama_event` seperti `DataPelangganBerubah`.  Begitu
juga saat data pelanggan dihapus, saya menggunakan SQL `INSERT` yang menambahkan *event* `PelangganDihapus`.

Pada contoh di atas, saya menyimpan isi dari *event* dalam bentuk teks JSON di kolom `payload`. Hal ini karena setiap jenis *event* memiliki skema 
berbeda dan saya tidak ingin memaksakan mereka agar muat dalam satu tabel.

Bila saya men-*query* tabel ini, saya akan memperoleh hasil seperti:

```sql
SELECT * FROM latihan.event_store ORDER BY tanggal;
```


nama_event             |       tanggal       |                                            payload                                            |
-----------------------|---------------------|-----------------------------------------------------------------------------------------------|
  PelangganBaruDaftar  | 2021-02-01 01:00:00 | {"kodePelanggan": "C1", "nama": "Jocki Hendry", "poin": 0, "kategori": ["vip"]}               |
  PelangganBaruDaftar  | 2021-02-01 02:00:00 | {"kodePelanggan": "C2", "nama": "The Solid Snake", "poin": 10, "kategori": ["player"]}        |
  PelangganBaruDaftar  | 2021-02-01 03:00:00 | {"kodePelanggan": "C3", "nama": "The Liquid Snake", "poin": 10, "kategori": ["player"]}       |
  DataPelangganBerubah | 2021-02-01 05:01:00 | {"kodePelanggan": "C1", "nama": "Jocki Hendry", "poin": 100, "kategori": ["vip"]}             |
  DataPelangganBerubah | 2021-02-02 01:00:00 | {"kodePelanggan": "C1", "nama": "Jocki Hendry", "poin": 200, "kategori": ["tester", "vip"]}   |
  DataPelangganBerubah | 2021-02-02 02:00:00 | {"kodePelanggan": "C2", "nama": "The Solid Snake", "poin": 10, "kategori": ["player", "vip"]} |
  PelangganDihapus     | 2021-02-03 01:00:00 | {"kodePelanggan": "C1", "nama": "Jocki Hendry"}                                               |

<br/>

Walaupun *event store* sangat berguna, biasanya aplikasi tidak perlu membaca data mentah ini secara langsung.  Sebagai contoh,
di halaman daftar pelanggan, saya hanya ingin menampilkan data pelanggan yang terbaru, setelah perubahan paling aktual dan
tidak termasuk pelanggan yang sudah dihapus.  Untuk itu, saya bisa menggunakan *query* SQL seperti berikut ini:

```sql
SELECT 
    r.payload
FROM (
    SELECT 
        FIRST_VALUE(e.payload) OVER (
            PARTITION BY JSON_QUERY(e.payload, '$.kodePelanggan')
            ORDER BY tanggal DESC        
        ) AS payload,
        FIRST_VALUE(e.nama_event) OVER (
            PARTITION BY JSON_QUERY(e.payload, '$.kodePelanggan')
            ORDER BY tanggal DESC        
        ) = 'PelangganDihapus' AS dihapus
    FROM latihan.event_store e 
    WHERE e.nama_event IN ('PelangganBaruDaftar', 'DataPelangganBerubah', 'PelangganDihapus')
    ORDER BY e.nama_event, e.tanggal DESC
) r 
WHERE NOT r.dihapus 
GROUP BY r.payload;
```

payload                                                                                       |
----------------------------------------------------------------------------------------------|
{"kodePelanggan": "C2", "nama": "The Solid Snake", "poin": 10, "kategori": ["player", "vip"]} |
{"kodePelanggan": "C3", "nama": "The Liquid Snake", "poin": 10, "kategori": ["player"]}       |

<br/>

Pada hasil query di atas, pelanggan `C1` tidak disertakan karena pelanggan tersebut dihapus pada `2021-02-03 09:00:00+07`.  Dengan *event sourcing*, 
saya seperti memiliki mesin waktu.  Saya bisa melihat kondisi entitas pada masa lampau dengan mudah.  Bagaimana bila saya ingin melihat daftar pelanggan pada 
tanggal `2021-02-01`?  Saya cukup  menambahkan kondisi `e.tanggal < TIMESTAMP('2021-02-02 00:00:00+07')` seperti pada *query* berikut ini:

```sql
SELECT 
    r.payload
FROM (
    SELECT 
        FIRST_VALUE(e.payload) OVER (
            PARTITION BY JSON_QUERY(e.payload, '$.kodePelanggan')
            ORDER BY tanggal DESC        
        ) AS payload,
        FIRST_VALUE(e.nama_event) OVER (
            PARTITION BY JSON_QUERY(e.payload, '$.kodePelanggan')
            ORDER BY tanggal DESC        
        ) = 'PelangganDihapus' AS dihapus
    FROM latihan.event_store e 
    WHERE 
        e.nama_event IN ('PelangganBaruDaftar', 'DataPelangganBerubah', 'PelangganDihapus') AND 
        e.tanggal < TIMESTAMP('2021-02-02 00:00:00+07')
    ORDER BY e.nama_event, e.tanggal DESC
) r 
WHERE NOT r.dihapus 
GROUP BY r.payload;
```

payload                                                                                       |
----------------------------------------------------------------------------------------------|
{"kodePelanggan": "C2", "nama": "The Solid Snake", "poin": 10, "kategori": ["player"]}        |
{"kodePelanggan": "C1", "nama": "Jocki Hendry", "poin": 100, "kategori": ["vip"]}             |
{"kodePelanggan": "C3", "nama": "The Liquid Snake", "poin": 10, "kategori": ["player"]}       |

<br/>

Kali ini, pelanggan `C1` disertakan karena pada tanggal `2021-02-01`, pelanggan tersebut belum dihapus.  Selain itu, nilai
untuk *propery* `poin` dan `kategori` sesuai dengan kondisi `2021-02-01` sebelum *event* `DataPelangganBerubah` terjadi di 
keesokan harinya.

Sampai di-sini, saya sudah bisa merasakan salah satu keuntungan yang didapat dengan menerapkan pola *event sourcing*: mesin waktu.  
Walapun demikian, *query* yang dilakukan terasa sangat kompleks.  Apakah bisa disederhanakan? Iya, tentu saja!  Saya bisa menggunakan fasilitas
*view* untuk menyederhanakan *query* tersebut. Sebagai contoh, saya bisa membuat *view* dengan nama `pelanggan` seperti berikut ini:

```sql
CREATE VIEW latihan.pelanggan AS
SELECT 
    r.payload
FROM (
    SELECT 
        FIRST_VALUE(e.payload) OVER (
            PARTITION BY JSON_QUERY(e.payload, '$.kodePelanggan')
            ORDER BY tanggal DESC        
        ) AS payload,
        FIRST_VALUE(e.nama_event) OVER (
            PARTITION BY JSON_QUERY(e.payload, '$.kodePelanggan')
            ORDER BY tanggal DESC        
        ) = 'PelangganDihapus' AS dihapus
    FROM latihan.event_store e 
    WHERE e.nama_event IN ('PelangganBaruDaftar', 'DataPelangganBerubah', 'PelangganDihapus')        
    ORDER BY e.nama_event, e.tanggal DESC
) r 
WHERE NOT r.dihapus 
GROUP BY r.payload;
```

Berbeda dengan tabel biasa, *view* tidak mendukung operasi DML seperti `INSERT`,`UPDATE`, dan sebagainya.  *View* hanya bisa
di-*query* dengan menggunakan `SELECT`.  Perilaku ini tepat seperti yang saya harapkan.  Aplikasi dapat membaca isi tabel 
`pelanggan` untuk menampilkannya di sebuah daftar.  Akan tetapi, untuk memodifikasi pelanggan, aplikasi perlu mengirim *command* (bila
mengikuti CQRS) yang akan menambahkan *event* baru di *event store*.

Sekarang, saya bisa mencari pelanggan dengan nama `C2` di *view* `pelanggan` dengan *query* yang sederhana seperti:

```sql
SELECT payload FROM latihan.pelanggan WHERE JSON_VALUE(payload, '$.kodePelanggan') = 'C2';
```

payload                                                                                       |
----------------------------------------------------------------------------------------------|
{"kodePelanggan": "C2", "nama": "The Solid Snake", "poin": 10, "kategori": ["player", "vip"]} |

<br/>

Walaupun lebih sederhana dari versi sebelumnya, *query* yang saya tulis di atas masih terasa aneh.  Saya  harus menggunakan 
operator `JSON_VALUE` atau `JSON_QUERY` untuk mencari nilai di dalam *payload*. Akan lebih baik bila saya bisa melakukan 
konversi setiap *property* di dalam *payload* JSON menjadi *field* di *view* tersebut. Untuk itu, saya akan membuat ulang *view* 
 dengan menggunakan *query* seperti:

```sql
CREATE VIEW latihan.pelanggan AS 
WITH source AS (
    SELECT 
        r.payload AS payload
    FROM (
        SELECT 
            FIRST_VALUE(e.payload) OVER (
                PARTITION BY JSON_QUERY(e.payload, '$.kodePelanggan')
                ORDER BY tanggal DESC        
            ) AS payload,
            FIRST_VALUE(e.nama_event) OVER (
                PARTITION BY JSON_QUERY(e.payload, '$.kodePelanggan')
                ORDER BY tanggal DESC        
            ) = 'PelangganDihapus' AS dihapus
        FROM latihan.event_store e 
        WHERE e.nama_event IN ('PelangganBaruDaftar', 'DataPelangganBerubah', 'PelangganDihapus')        
        ORDER BY e.nama_event, e.tanggal DESC
    ) r 
    WHERE NOT r.dihapus 
    GROUP BY r.payload
)
SELECT
  JSON_VALUE(payload, '$.kodePelanggan') AS kodePelanggan,
  JSON_VALUE(payload, '$.nama') AS nama,
  SAFE_CAST(JSON_VALUE(payload, '$.poin') AS NUMERIC) AS poin,
  ARRAY(SELECT JSON_EXTRACT_SCALAR(k, '$') FROM UNNEST(JSON_EXTRACT_ARRAY(payload, '$.kategori')) AS k) AS kategori
FROM source; 
```

*Query* di atas akan membuat sebuah *view* dengan 5 kolom: `kodePelanggan` dan `nama` dengan tipe `STRING`, `poin` dengan
tipe `NUMERIC` dan `kategori` dengan tipe *array*.  Bila saya men-*query* tabel *view* tersebut, saya akan memperoleh hasil 
seperti berikut ini:

```sql
SELECT * FROM latihan.pelanggan;
```

kodePelanggan   |       nama       | poin |     kategori     |
----------------|------------------|------|------------------|
  C3            | The Liquid Snake |   10 | ["player"]       |
  C2            | The Solid Snake  |   10 | ["player","vip"] |

<br/>

Sama seperti di tabel pada umumnya, saya bisa menambahkan kondisi `WHERE` seperti:

```sql
SELECT * FROM latihan.pelanggan WHERE kodePelanggan = 'C2';
SELECT * FROM latihan.pelanggan WHERE nama LIKE '%Snake%';
SELECT * FROM latihan.pelanggan WHERE poin > 5;
```

Saya juga bisa melakukan transformasi tabel *view* tersebut, misalnya, saya bisa menggunakan *query* berikut ini untuk
mendapatkan jumlah pelanggan berdasarkan kategori:

```sql
SELECT kategori, COUNT(kodePelanggan) AS total
FROM latihan.pelanggan p
CROSS JOIN UNNEST(p.kategori) AS kategori
GROUP BY kategori;
```

kategori  | total   |
----------|---------|
player    | 2       |
vip       | 1       |

<br/>

*Query* diatas menggunakan `UNNEST` untuk mengubah *array* menjadi *record* seperti yang lakukan pada tulisan 
[Menggunakan Array Di Big Query]({% post_url 2020-07-11-menggunakan-array-di-big-query %}).  Salah satu keuntungan melakukan
agregasi di *event sourcing* dibandingkan dengan menggunakan akumulator seperti biasanya adalah saya akan selalu memperoleh 
nilai yang konsisten dan akurat.  Nilai `total` pada *query* di atas dihasilkan berdasarkan rangkaian *event* `PelangganBaruDaftar`,
`DataPelangganBerubah` dan `PelangganDihapus`.  Saya sama sekali tidak menyimpan sebuah nilai akumulator yang ditambah atau dikurangi
setiap kali kategori berubah.  Dengan demikian, aplikasi saya akan terhindar dari permasalahan *update* akumulator yang tidak konsisten
(misalnya akibat batas transaksi database yang salah).  Nilai *total* versi *event sourcing* tidak akan pernah mencapai `-1`, sementara
pada versi akumulator, akibat berbagai faktor, nilai akumulator mungkin saja ter-*update* dengan nilai yang salah sehingga nilai
tersebut tidak lagi akurat untuk perubahan-perubahan selanjutnya.