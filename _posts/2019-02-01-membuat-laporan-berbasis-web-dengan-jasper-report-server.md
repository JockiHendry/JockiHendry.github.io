---
layout: post
category: Pemograman
title: Membuat Laporan Berbasis Web Dengan JasperReports Server
tags: [JasperReports]
---

Pada suatu hari, saya perlu membuat fasilitas untuk menampilkan dan mencetak laporan.  Lebih spesifiknya, saya perlu menampilkan laporan finansial dengan jumlah data yang besar.  Pengguna harus bisa men-*filter* laporan, berpindah halaman dan mencetak seluruh halaman laporan dalam bentuk dokumen PDF.  Ini adalah sebuah filter yang umum, bukan?  Google Cloud Platform menyediakan sebuah layanan laporan yang bernama Google Data Studio.  Sayangnya, saat mencoba produk tersebut, saya menemukan bahwa ia hanya bisa menampilkan tabel sederhana.  Saat mencoba mencetak dan meng-*export* laporan ke dalam PDF, Google Data Studio hanya mau mencetak halaman yang sedang aktif, bukannya seluruh halaman yang ada.  Sepertinya produk tersebut lebih tepat dipakai untuk menampilkan rangkuman atau laporan yang dilihat di layar (bukan untuk di-cetak).  Padahal, di Indonesia, masih banyak pengguna yang memilih membaca laporan yang sudah dicetak.

Oleh sebab itu, pada kesempatan ini, saya akan menggunakan JasperReports Server Community Edition (CE) yang dapat dipakai secara gratis asalkan saya memiliki *server* untuk men-*hosting* aplikasi Java tersebut.  Yup, pada dasarnya JasperReports Server adalah sebuah aplikasi web yang dibuat dengan menggunakan Spring Framework.

Agar memudahkan proses *deployment*, saya akan menggunakan Docker untuk menjalankan JasperReports Server.  Saya menemukan sebuah image JasperReports Server siap pakai di <https://hub.docker.com/r/bitnami/jasperreports/>.  Untuk menggunakannya, saya segera memberikan perintah berikut ini:

> $ <strong>curl -sSL https://raw.githubusercontent.com/bitnami/bitnami-docker-jasperreports/master/docker-compose.yml > docker-compose.yml</strong>

> $ <strong>docker-compose up</strong>

<div class="alert alert-info" role="alert">
<p>
	Pada saat tulisan ini dibuat, saya menemukan permasalahan pada Docker image dari Bitnami dimana saya tidak bisa menampilkan laporan.  Walaupun berhasil login ke dalam <em>dashboard</em> JasperReports Server, setiap kali menampilkan laporan, saya selalu menjumpai pesan kesalahan <code class="highlighter-rouge">net.sf.jasperreports.engine.JRRuntimeException: Error initializing graphic environment</code> dan <code>Caused by: java.lang.NullPointerException at sun.awt.FontConfiguration.getVersion(FontConfiguration.java:1264)</code>.
</p>
<p>
	Untuk mengatasi permasalahan ini, saya perlu masuk ke dalam <em>container</em> dan memberikan perintah berikut ini:
</p>
<pre>
	$ sed -i 's/main/& non-free contrib/' /etc/apt/sources.list
	$ apt update
	$ apt install msttcorefonts fontconfig
</pre>
</div>

Setelah itu, saya bisa membuka dashboard JasperReports Server melalui browser di URL <http://localhost>.  Untuk login ke *dashboard*, saya bisa menggunakan nilai default untuk *user* berupa `user` dan *password* berupa `bitnami`.  Bila ingin mengubah *user* dan *password*, saya bisa membuka file `docker-compose.yml` dan menambahkan variabel `JASPERREPORTS_USERNAME` dan `JASPERREPORTS_PASSWORD` di bagian `environment` milik *service* `jasperreports`.

Untuk menggunakan JasperReports Server, saya perlu melakukan beberapa langkah berikut ini:

1. Membuat *data source*.
1. Merancang laporan JRXML dengan menggunakan Jaspersoft Studio.
1. Menyisipkan laporan ke dalam aplikasi web.

### Membuat *data source*

JasperReports Server mendukung semua *data source* yang menyediakan driver JDBC seperti MySQL, MariaDB, Oracle Database, PostgreSQL dan sebagainya.  Bila itu tidak cukup, *data source* juga bisa berupa file CSV, XLS, dan JSON.  Pada tulisan kali ini, saya akan mencoba menggunakan JSON *data source*.  Sumbernya bisa dalam bentuk file yang berisi JSON atau URL yang mengembalikan JSON.

Karena menggunakan JSON *data source* dalam bentuk file akan sangat berguna dalam menguji laporan, saya akan mulai dengan membuat file JSON seperti berikut ini:

```json
[
	{
		"id": 1,
		"sku": "ITEM-1",
		"category": "CAT-1",
		"name": "Item1",
		"date": "2019-01-01",
		"rate": 1000,
		"qty": 10,
		"amount": 10000,
		"reference": "INVOICE-1"
	},
	{
		"id": 1,
		"sku": "ITEM-1",
		"category": "CAT-1",
		"name": "Item1",
		"date": "2019-01-02",
		"rate": 1000,
		"qty": 20,
		"amount": 20000,
		"reference": "INVOICE-2"					
	},		
	{
		"id": 2,
		"sku": "ITEM-2",
		"category": "CAT-1",
		"name": "Item2",		
		"date": "2019-01-03",
		"rate": 500,
		"qty": 5,
		"amount": 2500,
		"reference": "INVOICE-3"	
	},
	{
		"id": 3,
		"sku": "ITEM-3",
		"category": "CAT-2",
		"name": "Item3",		
		"date": "2019-01-04",
		"rate": 1200,
		"qty": 3,
		"amount": 3600,
		"reference": "INVOICE-4"		
	}
]
```

Untuk keperluan produksi, saya bisa menggantikan file JSON di atas dengan sebuah *endpoint* yang mengembalikan JSON dengan struktur serupa sehingga isi laporan sesuai dengan yang tersimpan di database.  Karena saya tidak mengakses database secara langsung, *endpoint* ini bisa saja mengembalikan hasil dari database yang tidak mendukung JDBC seperti Firestore, Elasticsearch dan sebagainya.

Untuk mendeklarasikan *data source* yang telah dibuat, saya perlu membuka *Repository Explorer* dan men-klik icon **Create Data Adapter**.  Pada pilihan *data adapters* yang muncul, saya memilih *JSON File*.  Setelah men-klik tombol **Next**, saya menentukan lokasi file yang berisi JSON yang hendak ditampilkan selama pengujian.

<div class="alert alert-warning" role="alert">
Pada versi JasperReports Server yang saya pakai saat tulisan ini dibuat, mendefinisikan <em>data source</em> JSON secara terpisah di <em>dashboard</em> JasperReports Server tidak akan bekerja.  Saya harus memastikan <em>data source</em> dipublikasikan langsung dari Jaspersoft Studio.  Ini terasa sangat tidak intuitif dan membingungkan.
</div>

### Merancang laporan JRXML dengan menggunakan Jaspersoft Studio

Setelah berhasil memmbuat *data source*, langkah berikutnya adalah merancang laporan.  Untuk itu, saya akan men-*download* dan menjalankan aplikasi Jaspersoft Studio yang berbasis Eclipse.  Setelah itu, saya bisa membuat laporan baru dengan memilih menu **File**, **New**, **Jasper Report**.  Selain itu, bila melakukan migrasi dari aplikasi desktop atau laporan yang sudah dibuat sebelumnya, saya tinggal menambahkan file JRXML tersebut ke dalam *workspace* yang sedang aktif.

Sebagai contoh, berikut ini adalah rancangan laporan yang saya buat di Jaspersoft Studio:

![Merancang Laporan Di Jaspersoft Studio]({{ "/assets/images/gambar_00030.png" | relative_url}}){:class="img-fluid rounded"}

Pada rancangan laporan tersebut, saya menggunakan fasilitas seperti *grouping* untuk mengelompokkan baris dengan SKU yang sama, *styling* untuk memberikan *background* berbeda pada setiap baris, dan *variable* untuk menghitung total per SKU dan total untuk seluruh item di laporan.  Tentu saja JasperReports masih memiliki banyak fitur menarik lainnya yang tidak sempat saya pakai dalam waktu yang singkat ini.

Setelah menghubungkan rancangan laporan tersebut dengan *data source*, saya bisa men-klik tab *Preview* untuk melihat seperti apa tampilan laporan tersebut:

![Tampilan Preview Laporan]({{ "/assets/images/gambar_00031.png" | relative_url}}){:class="img-fluid rounded"}

Sebelum mempublikasikan laporan ke JasperReports Server, saya perlu mengisi nilai *Default Data Adapter* dengan *data source* yang saya pakai, seperti yang terlihat pada gambar berikut ini:

![Mengisi Default Data Adapter]({{ "/assets/images/gambar_00032.png" | relative_url}}){:class="img-fluid rounded"}

Saya kemudian men-klik icon  **Create JasperReports Server Connection** di *Repository Explorer* untuk menghubungkan Jaspersoft Studio dengan JasperReports Server.  Pada dialog yang muncul, saya mengisi lokasi *ip address* dan *port* dimana JasperReports Server berada.  Selain itu, saya juga perlu memasukkan informasi pengguna (user `user` dan password `bitnami`).

Setelah berhasil membuat koneksi ke JasperReports Server, saya bisa men-klik icon **Publish To JasperReports Server** (saat sedang berada di tab *Design*) untuk mempublikasikan laporan JRXML ke JasperReports Server.  Pada dialog yang muncul, saya memilih salah satu *folder* yang sudah saya buat sebelumnya di JasperReports Server.  Pada langkah kedua, terlihat bahwa Jaspersoft Studio juga akan mempublikasi *data source* yang dipakai oleh laporan ini.  Pada langkah terakhir, saya harus memilih **Don't use any Data Source**.

Setelah proses publikasi selesai, saya bisa menampilkan laporan tersebut di browser melalui *dashboard* JasperReports Server, seperti yang terlihat pada gambar berikut ini:

![Tampilan Laporan Di JasperReports Server]({{ "/assets/images/gambar_00033.png" | relative_url}}){:class="img-fluid rounded"}

### Menyisipkan laporan ke dalam aplikasi web

Cara paling cepat untuk menyisipkan laporan ke dalam aplikasi yang sudah ada adalah melalui iframe.  Sebagai contoh, saya bisa menggunakan HTML seperti berikut ini:

```html
<html>
    <head>
        <title>Latihan</title>
        <style>
            html, body {
                height: 100%;
            }
            iframe {                                
                width: 100%;
                height: 100%;
            }
        </style>
    </head>
    <body>
        <h1>Ini adalah contoh halaman aplikasi</h1>
        <iframe src="http://localhost/jasperserver/flow.html?_flowId=viewReportFlow&_flowId=viewReportFlow&ParentFolderUri=%2Ftest&reportUnit=%2Ftest%2Finventory_valuation&standAlone=true&decorate=no&j_username=user&j_password=bitnami" frameborder="0">
        </iframe>
    </body>
</html>
```

Saya menambahkan `decorate=no` untuk membuang header di tampilan laporan.  Bila laporan mengandung *parameter*, saya juga bisa menambahkan parameter GET dengan nama yang sesuai dengan di laporan.  Selain itu, saya bisa menyisipkan username dan password secara langsung melalui `j_username` dan `j_password`.  Cara ini sebenarnya tidak aman, tetapi paling cepat untuk memperoleh hasil seperti pada gambar berikut ini:

![Tampilan Laporan Sebagai iFrame]({{ "/assets/images/gambar_00034.png" | relative_url}}){:class="img-fluid rounded"}

Bila saya hanya ingin menampilkan isi tabel dalam bentuk HTML pada halaman tertentu atau men-*download* file PDF dari laporan, saya bisa menggunakan URL dengan format `http://localhost/jasperserver/rest_v2/reports/path/ke/laporan/file.ekstensi` seperti `http://localhost/jasperserver/rest_v2/reports/test/laporan.html` atau `http://localhost/jasperserver/rest_v2/reports/test/laporan.pdf`.