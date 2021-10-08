---
layout: post
category: Network
title: Cara Kerja DNS
tags: [DNS]
---

Mengapa sebuah website memiliki alamat seperti `www.latihan.com`?  Apa artinya `www` dan `com`?  Untuk menjawab pertanyaan ini, saya harus memahami terlebih dahulu cara kerja Domain Name System (DNS).  DNS adalah sebuah sistem yang terdiri atas banyak server berbeda dengan tujuan utama menerjemahkan nama seperti `www.google.com` menjadi *IP address*.

Pada awalnya, untuk berkomunikasi dengan sebuah server, seseorang harus mengingat *IP address* server tujuan.  Setiap server yang terhubung ke Internet memiliki *IP address* yang unik seperti `216.58.219.196`.  Untuk mengatasi masalah ini, beberapa variasi *name server* diciptakan dengan tujuan memetakan *IP address* ke dalam bentuk nama yang lebih mudah diingat.  Dengan demikian, untuk menghubungi berbagai server lainnya, seseorang hanya perlu tahu *IP address* dari *name server*.  Pengguna tinggal menanyakan nama server tujuan ke *name server* dan *name server* akan mengembalikan *IP address*.

Jadi, *name server* boleh dibilang adalah sebuah database yang terdiri atas nama dan *IP address*.  Selain sering dibaca, database ini juga perlu diperbaharui karena para pemilik server baru akan mendaftarkan nama server mereka.  Sama seperti database manapun, semakin hari seiring waktu berlalu, *name server* bisa menjadi penuh dan lambat!  Lalu apa solusinya?  Domain Name System (DNS) terlahir untuk menjawab pertanyaan ini.  Sejak tahun 1987 hingga tulisan ini dibuat, DNS masih menjadi solusi yang bekerja dengan baik.

### Struktur Organisasi

DNS menggunakan penamaan yang bersifat hierarkial.  Sebagai contoh, nama `www.latihan.com.` terdiri 4 bagian yang dibaca dari paling kanan menuju ke kiri:
1.  Sebuah titik (.) paling kanan yang mewakili *root*.  Titik ini biasanya boleh diabaikan oleh pengguna tetapi penting pada saat melakukan konfigurasi *zone file* yang mensyaratkan penamaan Fully Qualified Domain Name (FQDN).  Pada BIND, misalnya, bila sebuah nama domain tidak diakhir titik, maka nilai `$ORIGIN` secara otomatis akan ditambahkan pada nama tersebut.
1.  Top-Level Domain (TLD) yang pada contoh ini adalah `.com`.
1.  Second-Level Domain (SLD) yang pada contoh ini adalah `latihan`.
1.  Host name yang pada contoh ini adalah `www`.

Yang uniknya, pada DNS, tidak ada satu database pusat.  DNS terdiri atas beberapa server berbeda dengan tanggung jawab (*authority*) di pihak berbeda tergantung pada hierarkinya.  Pada hierarki tertinggi, terdapat apa yang disebut sebagai *root name server*.  Ini adalah server yang pasti akan selalu dihubungi saat seseorang menggunakan DNS.  *Root name server* merupakan wewenang ICANN.  Pada saat tulisan ini dibuat, terdapat 13 *root server* yang terdiri atas 922 *instances*.  *Root server* memiliki nama seperti `a.root-servers.org` hingga `m.root-servers.org`.  Informasi lebih lanjut tentang masing-masing *root name server* (seperti apa *IP address* dan lokasi mereka) dapat dibaca di <http://www.root-servers.org>.

Pada contoh `www.latihan.com`, respon yang dikembalikan setelah menghubungi *root name server* adalah referensi ke salah satu *TLD name server*, tepatnya *TLD name server* untuk `.com`.  TLD dapat dibedakan menjadi dua jenis:

* gTLD (*generic*)
  > Pada awalnya, gTLD terdiri atas `.com`, `.edu`, `.gov`, `.mil` dan `.org`.  Seiring waktu berlalu, ICANN menambahkan banyak gTLD lainnya seperti `.asia`, `.cat`, `.jobs` dan sebagainya.  Apabila gTLD yang ada sekarang belum cukup, siapa saja bisa mendaftarkan gTLD baru di <https://newgtlds.icann.org/en/applicants/agb>.  Tentu saja ini bukan hal mudah, selain membutuhkan biaya besar, penanggung jawab gTLD baru wajib memenuhi persyaratan teknis seperti menyediakan *name server* yang menampung SLD.

  > Walaupun ICANN memiliki wewenang atas gTLD, operasional untuk gTLD didelegasikan ke *registry operator*.  Selain itu, terdapat entitas yang disebut *registrars* yang berperan menambahkan (atau mengubah) data baru ke *name server* yang dikelola oleh *registry operator*.  Daftar *registrar* dapat dilihat di <https://www.icann.org/registrar-reports/accredited-list.html>.  Pengguna akhir seperti saya bisa membeli domain pada *registrar* seperti GoDaddy.
  >
* ccTLD (*country code*)
  > ccTLD terdiri atas dua karakter ISO 3166 yang mewakili sebuah negara.  Walaupun ccTLD juga dikendalikan oleh ICANN, operasional umumnya diserahkan secara penuh kepada *country manager* untuk negara bersangkutan.  Daftar *country manager* untuk ccTLD yang ada dapat dijumpai di <https://www.iana.org/domains/root/db>.  Sebagai contoh, terlihat bahwa ccTLD `.id` dikelola oleh Perkumpulan Pengelola Nama Domain Internet Indonesia (PANDI).

  > *Country manager* untuk ccTLD berhak melakukan pengelolaan untuk SLD dibawahnya sesuai *'selera masing-masing'*.  Sebagai contoh, untuk ccTLD `.id`, terdapat pembagian SLD berdasarkan fungsionalitas seperti `ac.id` untuk institusi akademik, `co.id` untuk keperluan komersial, `go.id` untuk pemerintah, `my.id` untuk keperluan pribadi / blog dan sebagainya.

  > Mengapa pada situs ini, saya menggunakan domain ccTLD `.me` yang merupakan ccTLD untuk negara Montenegro, bukannya `.my.id`?  Salah satu alasannya adalah registrasi domain `.id` mensyaratkan verifikasi identitas seperti dokumen SIUP, NPWP atau KTP yang membuktikan bahwa situs berhubungan dengan Indonesia; sementara itu, saya bisa membeli domain `.me` tanpa verifikasi karena *country manager*-nya membolehkan individu atau perusahaan di belahan dunia manapun untuk menggunakan `.me` secara bebas.

Kembali pada contoh `www.latihan.com`, setelah memperoleh lokasi *name server* untuk `latihan.com` dari gTLD `.com`, DNS resolver akan menanyakan *IP address* untuk host `www` pada *name server* tersebut.  Pemilik domain sesungguhnya bisa melakukan pemetaan ke server mereka secara bebas dengan menggunakan nama apa saja. Pada awal mula Internet, `www` merupakan sebuah nama standar untuk web server.  Anggap saja `www` adalah penamaan *best practise* yang sudah tidak banyak diterapkan lagi saat ini!

### Konfigurasi Zone

Saatnya untuk lebih detail lagi: bagaimana sebuah *name server* menyimpan pemetaan dari nama ke *IP address*?  DNS menggunakan file teks yang disebut sebagai *zone file* untuk mendeskripsikan domain yang ditangani *name server* (disebut juga sebagai *zone*).  Pada saat menyewa domain di *registrar*, biasanya pengguna sudah disediakan *name server* bawaan.  Hampir semua penjual domain memiliki user interface berbasis web untuk mempermudah mengubah *zone file* di *name server* tersebut.  Beberapa penjual, misalnya GoDaddy, memungkinkan pengguna untuk men-*export* *zone file* guna mempermudah migrasi ke *name server* lain.  Sebagai contoh, ini adalah *zone file* bawaan yang saya *export* dari GoDaddy:

```
; Domain: xyzxyz.xyz
; Exported (y-m-d hh:mm:ss): 2018-05-23 13:10:09
;
; This file is intended for use for informational and archival
; purposes ONLY and MUST be edited before use on a production
; DNS server.
;
; In particular, you must update the SOA record with the correct
; authoritative name server and contact e-mail address information,
; and add the correct NS records for the name servers which will
; be authoritative for this domain.
;
; For further information, please consult the BIND documentation
; located on the following website:
;
; http://www.isc.org/
;
; And RFC 1035:
;
; http://www.ietf.org/rfc/rfc1035.txt
;
; Please note that we do NOT offer technical support for any use
; of this zone data, the BIND name server, or any other third-
; party DNS software.
;
; Use at your own risk.

; SOA Record
xyzxyz.xyz.	600	IN	SOA	ns33.domaincontrol.com.	dns.jomax.net (
				2017111600
				28800
				7200
				604800
				600
				)

; A Records
@	600	IN	A	>>++PARKED1++<<

; CNAME Records
www	3600	IN	CNAME	@
ftp	3600	IN	CNAME	@
_domainconnect	3600	IN	CNAME	_domainconnect.gd.domaincontrol.com

; NS Records
@	3600	IN	NS	ns34.domaincontrol.com
@	3600	IN	NS	ns33.domaincontrol.com
```

*Zone file* di atas sebagian besar terdiri dari komentar yang diawali oleh titik koma (`;`).  Setiap baris yang bukan komentar mewakili apa yang disebut sebagai Resource Records (RR).  Saya dapat menjumpai 3 jenis RR di file tersebut, yaitu Start of Authority (SOA) RR, Address (A) RR, Canoninal Name (CNAME) RR dan Name Server (NS) RR.

SOA RR adalah RR yang harus muncul pertama kali pada *zone file* dan setiap *zone file* wajib memiliki SOA RR.  Pada contoh di atas, SOA RR menunjukkan bahwa *zone file* tersebut dipakai untuk konfigurasi *zone* `xyzxyz.xyz.`.  Email administrator yang bertanggung jawab adalah `dns@jomax.net`; pada SOA RR, email menggunakan tanda titik (`.`) karena tanda ampersat (`@`) memiliki makna khusus di *zone file*.  Bagian yang berada dalam tanda kurung adalah informasi seperti SERIAL (kode versi unik yang harus berubah bila file ini dimodifikasi), REFRESH (seberapa sering *zone* ini harus diperbaharui), RETRY (seberapa lama harus menunggu setelah terjadi kegagalan), EXPIRE (seberapa lama harus menunggu setelah RETRY gagal sebelum memutuskan *zone* ini tidak berlaku lagi) dan MINIMUM (seberapa lama respon negatif seperti `NXDOMAIN` harus di-*cache*).

A RR melakukan pemetaan dari nama host ke *IPv4 address*.  Pada contoh di atas, nilai `@` merupakan sinonim untuk `$ORIGIN` yang merujuk pada *zone* yang aktif, yaitu `xyzxyz.xyz.`.  Bagian *IPv4 address* harus merupakan nilai seperti `123.456.789.123`, akan tetapi pada file hasil *export* yang saya peroleh, nilainya adalah `>>++PARKED1++<<`.  Ini adalah nilai yang **TIDAK VALID** untuk sebuah *zone file* standar!  Bila saya ingin menggunakan file ini di *name server* pribadi, saya perlu mengubah nilai tersebut ke sebuah *IPv4 address* yang merujuk pada sebuah server.

CNAME RR dipakai untuk mendefinisikan sinonim ke A RR.  Pada contoh di atas, host `www` adalah sinonim dari `@` yang merujuk pada `xyzxyz.xyz.`.  Begitu juga dengan host `ftp`.  Dengan demikian, *IPv4 address* yang dikembalikan untuk pencarian `xyzxyz.xyz`, `www.xyzxyz.xyz`, dan `ftp.xyzxyz.xyz` adalah *IPv4 address* yang sama.  Lalu apa itu CNAME untuk `_domainconnect`?  Ini untuk keperluan *service discovery* dari fasilitas Domain Connect yang diluncurkan GoDaddy supaya DNS server dapat dikonfigurasi secara otomatis dimana pemilik domain bisa mengaktifkan server-nya tanpa perlu menyentuh *zone file* sama sekali.  Saya bisa menghapus baris ini dengan aman.

NS RR berisi referensi ke *authoritative name server*.  Pada contoh di atas, terlihat bahwa nilai untuk *name server* tidak diakhiri oleh tanda titik (`.`).  Ini adalah sesuatu yang tidak standar bila saya merujuk ke referensi *zone file* untuk BIND.  Mungkin saja GoDaddy berusaha mempermudah pengguna karena lupa menambahkan tanda titik (`.`) merupakan kesalahan umum pada saat menulis *zone file* untuk BIND.

Selain record di atas, *zone file* juga bisa berisi RR lainnya seperti MX RR, TXT RR, PTR RR, AAAA RR, dan sebagainya.

### Operasi DNS

Setelah memahami struktur organisasi DNS yang hierarkial, sekarang saatnya mencari tahu bagaimana sesungguhnya proses yang terjadi saat saya menanyakan sebuah nama seperti `www.latihan.com` hingga memperoleh *IP address*.

Setiap sistem operasi memiliki apa yang disebut sebagai *DNS stub-resolver*.  Perannya adalah melakukan *caching* sehingga pencarian nama yang sama bisa dikembalikan secara cepat.  Bila saya mencari nama yang sudah pernah dicari sebelumnya, *DNS stub-resolver* akan segera mengembalikan *IP address* dari *cache*.  Bagaimana bila nama tersebut belum pernah dicari sebelumnya?  *DNS stub-resolver* akan menghubungi *DNS resolver* (biasanya disediakan oleh ISP, tapi bisa juga dari pihak ketiga seperti Google DNS `8.8.8.8`, CloudFare DNS `1.1.1.1`, dan sebagainya).

Untuk mensimulasikan cara kerja *DNS resolver*, saya bisa menggunakan fasilitas `+trace` dari perintah `dig` seperti berikut ini:

> <strong>$</strong> <code>dig @8.8.8.8 +trace -4 xyzxyz.xyz</code>

```
; <<>> DiG 9.11.3-1ubuntu1-Ubuntu <<>> @8.8.8.8 +trace -4 xyzxyz.xyz
; (1 server found)
;; global options: +cmd
.			102100	IN	NS	b.root-servers.net.
.			102100	IN	NS	g.root-servers.net.
.			102100	IN	NS	e.root-servers.net.
.			102100	IN	NS	k.root-servers.net.
.			102100	IN	NS	i.root-servers.net.
.			102100	IN	NS	m.root-servers.net.
.			102100	IN	NS	d.root-servers.net.
.			102100	IN	NS	c.root-servers.net.
.			102100	IN	NS	j.root-servers.net.
.			102100	IN	NS	a.root-servers.net.
.			102100	IN	NS	l.root-servers.net.
.			102100	IN	NS	f.root-servers.net.
.			102100	IN	NS	h.root-servers.net.
;; Received 525 bytes from 8.8.8.8#53(8.8.8.8) in 1 ms

xyz.			172800	IN	NS	y.nic.xyz.
xyz.			172800	IN	NS	z.nic.xyz.
xyz.			172800	IN	NS	generationxyz.nic.xyz.
xyz.			172800	IN	NS	x.nic.xyz.
;; Received 666 bytes from 199.9.14.201#53(b.root-servers.net) in 182 ms

xyzxyz.xyz.		3600	IN	NS	ns33.domaincontrol.com.
xyzxyz.xyz.		3600	IN	NS	ns34.domaincontrol.com.
;; Received 579 bytes from 194.169.218.42#53(x.nic.xyz) in 184 ms

xyzxyz.xyz.		600	IN	A	11.22.33.44
xyzxyz.xyz.		3600	IN	NS	ns33.domaincontrol.com.
xyzxyz.xyz.		3600	IN	NS	ns34.domaincontrol.com.
;; Received 110 bytes from 208.109.255.17#53(ns34.domaincontrol.com) in 2 ms
```

Berikut ini adalah proses query yang terjadi:

1. `dig` akan melakukan query untuk memperoleh *root servers*.
1. Setelah itu, ia memilih salah satu *root servers* dari respon di langkah sebelumnya, yaitu `b.root-servers.net`.
1. `dig` akan menanyakan informasi tentang gTLD `.xyz` pada `b.root-servers.net`.  Ia akan memperoleh respon berupa beberapa *name server* yang bisa menawarkan informasi lebih lanjut.  Disini, ia memilih untuk bertanya pada `x.nic.xyz`.
1. `dig` menanyakan informasi tentang SLD `xyzxyz.xyz` pada `x.nic.xyz`.  Kali ini ia memperoleh informasi tentang *authoritative name server* yang wajib menyediakan informasi untuk `xyzxyz.xyz`.
1. `dig` bertanya pada salah satu *authoritative name server* dan menerima A record.  Ini adalah jawaban yang dicari-cari: *IPv4 address* `11.22.33.44`.

Proses di atas disebut juga sebagai *iterative DNS query* atau *non-recursive DNS query*.  Kebalikannya, pada *recursive DNS query*, *name server* tujuan akan melakukan *DNS query* ke tingkat berikutnya dan mengembalikan hasilnya.  *DNS query* untuk *root servers* dan *TLD* selalu dilakukan secara *iterative* (*non-recursive*).  Itu sebabnya, saya tidak pernah bisa meminta hasil langsung dari *root servers*, seperti yang diperlihatkan oleh:

> <strong>$</strong> <code>dig @a.root-servers.net xyzxyz.xyz</code>

```
; <<>> DiG 9.11.3-1ubuntu1-Ubuntu <<>> @a.root-servers.net xyzxyz.xyz
; (2 servers found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 49837
;; flags: qr rd; QUERY: 1, ANSWER: 0, AUTHORITY: 4, ADDITIONAL: 9
;; WARNING: recursion requested but not available

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;xyzxyz.xyz.			IN	A

;; AUTHORITY SECTION:
xyz.			172800	IN	NS	x.nic.xyz.
xyz.			172800	IN	NS	generationxyz.nic.xyz.
xyz.			172800	IN	NS	z.nic.xyz.
xyz.			172800	IN	NS	y.nic.xyz.

;; ADDITIONAL SECTION:
x.nic.xyz.		172800	IN	A	194.169.218.42
x.nic.xyz.		172800	IN	AAAA	2001:67c:13cc::1:42
generationxyz.nic.xyz.	172800	IN	A	212.18.249.42
generationxyz.nic.xyz.	172800	IN	AAAA	2a04:2b00:13ff::42
z.nic.xyz.		172800	IN	A	212.18.248.42
z.nic.xyz.		172800	IN	AAAA	2a04:2b00:13ee::42
y.nic.xyz.		172800	IN	A	185.24.64.42
y.nic.xyz.		172800	IN	AAAA	2a04:2b00:13cc::1:42

;; Query time: 232 msec
;; SERVER: 2001:503:ba3e::2:30#53(2001:503:ba3e::2:30)
;; WHEN: Fri May 25 09:05:19 UTC 2018
;; MSG SIZE  rcvd: 295
```

Perhatikan bahwa tidak ada flag `ra` yang menunjukkan bahwa *name server* mendukung *recursion*.  Selain itu, ada peringatan `recursion requested but not available`.  Hal ini karena `dig` secara default akan meminta *name server* untuk melakukan *recursion* sehingga flag `rd` selalu aktif bila saya tidak menambahkan flag `+norecurse`.

Sekarang, saya sudah memahami dasar-dasar DNS.  Semoga pengetahuan ini bisa berguna suatu hari nanti saat saya menjumpai masalah, baik yang berhubungan dengan pemograman maupun tidak.