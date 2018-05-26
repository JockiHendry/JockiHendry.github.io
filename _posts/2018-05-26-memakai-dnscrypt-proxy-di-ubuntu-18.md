---
layout: post
category: OS
title: Memakai DNSCrypt-proxy 2 Di Ubuntu 18
tags: [Ubuntu, DNS]
---

Untuk mencegah penyadapan dan perubahan isi website oleh pihak yang tidak diinginkan, saya bisa menggunakan HTTPS yang melakukan enkripsi data yang dikirim.  Pihak ketiga seperti hacker dan/atau ISP, tidak akan melihat langsung teks HTML, melainkan data HTML yang sudah di-enkripsi.  Lalu bagaimana dengan DNS?  Teknologi serupa yang paling mendekati adalah DNSSEC, namun sayangnya, belum semua TLD dan *DNS resolver* mendukung DNSSEC!  Banyak pengguna DNS masih mengirim *DNS request* tanpa DNSSEC.  Lalu apa salahnya?  Pihak ketiga (termasuk ISP) bisa mengubah *IP address* hasil kembalian dari *DNS resolver* menjadi nilai yang berbeda. Tanpa DNSSEC atau enkripsi, pengguna tidak pernah yakin 100% bahwa hasil *IP address* yang diterima adalah benar yang dikembalikan *DNS resolver*.

Sebagai contoh, saya akan menghubungi *name server* `maxmind.test-ipv6.com` yang telah diprogram sedemikian rupa agar mengembalikan IP yang menghubunginya dalam TXT record:

> $ <strong>dig txt maxmind.test-ipv6.com @1.1.1.1</strong>

```
; <<>> DiG 9.11.3-1ubuntu1-Ubuntu <<>> txt maxmind.test-ipv6.com @1.1.1.1
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 38740
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;maxmind.test-ipv6.com.   IN  TXT

;; ANSWER SECTION:
maxmind.test-ipv6.com.  0 IN  TXT "ip='180.251.20.4' as='17974' isp='TELKOMNET-AS2-AP PT Telekomunikasi Indonesia' country='ID'"

;; Query time: 406 msec
;; SERVER: 1.1.1.1#53(1.1.1.1)
;; WHEN: Sat May 26 14:56:52 WIB 2018
;; MSG SIZE  rcvd: 155
```

Pada hasil di atas, terlihat bahwa walaupun saya menggunakan *DNS resolver* 1.1.1.1 milik Cloudfare, ternyata yang menghubung *name server* adalah IP milik penyedia Internet yang saya pakai.  Dengan demikian, hasil yang saya peroleh sesungguhnya tidak langsung dari Cloudfare, melainkan dari provider tersebut.  Apakah hal ini bisa dicegah?  Sebagai alternatif, sambil menunggu DNSSEC di-implementasi-kan oleh semua *name server* di seluruh dunia, saya bisa menggunakan DNSCrypt-proxy.

Proses instalasi DNSCrypt-proxy di Ubuntu sebenarnya cukup mudah; informasi lebih detail dapat dijumpai di halaman <https://github.com/jedisct1/dnscrypt-proxy/wiki/Installation-Debian-Ubuntu>.  Akan tetapi bila saya memakai paket yang sudah ada, `dnsmasq` juga akan ikut di-install sebagai *DNS local stub resolver*.  Padahal, sejak Ubuntu 17, `dnsmasq` sudah ditinggalkan dan digantikan oleh `systemd-resolved`.  Oleh sebab itu, kali ini saya akan men-install DNSCrypt-proxy 2 secara manual.

Saya akan mulai dengan men-download file `dnscrypt-proxy-linux_x86_64-2.0.14.tar.gz` dari `https://github.com/jedisct1/dnscrypt-proxy/releases/tag/2.0.14` dan men-*extract*-nya:

```
wget https://github.com/jedisct1/dnscrypt-proxy/releases/download/2.0.14/dnscrypt-proxy-linux_x86_64-2.0.14.tar.gz
sudo tar -xvzf dnscrypt-proxy-linux_x86_64-2.0.14.tar.gz
sudo mkdir /opt/dnscrypt-proxy
sudo cp linux-x86_64/dnscrypt-proxy /opt/dnscrypt-proxy/
sudo cp linux-x86_64/example-dnscrypt-proxy.toml /etc/dnscrypt-proxy.toml
```

Untuk menguji apakah DNSCrypt-proxy bisa bekerja, saya memberikan perintah berikut ini:

```
sudo /opt/dnscrypt-proxy/dnscrypt-proxy --config /etc/dnscrypt-proxy.toml
```

Bila perintah di atas bekerja dengan baik dimana saya mendapatkan baris seperti *"dnscrypt-proxy is ready"*, maka sekarang saya siap untuk mendaftarkannya agar selalu berjalan secara otomatis setiap kali komputer dinyalakan.  Saya pun memberikan perintah berikut ini:

```
sudo /opt/dnscrypt-proxy/dnscrypt-proxy -service install
```

Kemudian, saya melakukan perubahan pada file `/etc/systemd/system/dnscrypt-proxy.service`.  Saya menambahkan `--config /etc/dnscrypt-proxy.toml` pada perintah di bagian `ExecStart`.  Selain itu, saya juga menghapus bagian `WorkingDirectory`.  Sekarang, isinya akan terlihat seperti berikut ini:

```
[Unit]
Description=Encrypted/authenticated DNS proxy
ConditionFileIsExecutable=/opt/dnscrypt-proxy/dnscrypt-proxy
After=network.target dnscrypt-proxy.socket
Requires=dnscrypt-proxy.socket

[Service]
StartLimitInterval=5
StartLimitBurst=10
ExecStart=/opt/dnscrypt-proxy/dnscrypt-proxy --config /etc/dnscrypt-proxy.toml
Restart=always
RestartSec=120

[Install]
WantedBy=multi-user.target
```

Pada konfigurasi di atas, terlihat bahwa *service* `systemd` untuk DNSCrypt-proxy ini memiliki referensi ke `dnscrypt-proxy.socket`.  Pada `systemd`, *socket* juga adalah sebuah unit yang bisa dikelola.  Saya pun segera membuat file `dnscrypt-proxy.socket` di lokasi direktori yang sama dengan isi seperti berikut ini:

```
[Unit]
Description=dnscrypt-proxy listening socket
PartOf=dnscrypt-proxy.service

[Socket]
ListenStream=127.0.0.54:53
ListenDatagram=127.0.0.54:53

[Install]
WantedBy=sockets.target
```

Sebagai langkah terakhir, saya perlu mengubah file `/etc/dnscrypt-proxy.toml` dimana nilai `listen_addresses` yang sebelumnya berupa:

```
listen_addresses = ['127.0.0.1:53', '[::1]:53']
```

kini saya ubah menjadi:

```
listen_addresses = []
```

Mengapa kosong?  Karena *socket* yang dipakai kini tidak lagi ditentukan oleh file konfigurasi, melainkan dikelola oleh `systemd`.  Tentu saja ini bisa bekerja berkat kode program DNSCrypt-Proxy yang sudah mendukung unit *socket* di `systemd`.  Agar `systemd` membaca perubahan file *service* dan *socket*, saya memberikan perintah berikut ini:

```
sudo systemctl daemon-reload
```

Sekarang, saya bisa me-restart DNSCrypt-proxy dengan memberikan perintah berikut ini:

```
sudo systemctl restart dnscrypt-proxy
sudo systemctl status dnscrypt-proxy
```

Untuk memastikan bahwa *socket* dari `systemd` dipakai, saya bisa memberikan seperti `systemctl list-sockets` atau `systemctl status dnscrypt-proxy.socket`.

Pada Ubuntu 18, sudah ada sebuah *DNS stub resolver* yang disebut sebagai `systemd-resolved`.  Pertanyaan berikutnya adalah apakah saya masih ingin memakai `systemd-resolved` atau langsung memanggil DNSCrypt-proxy?  Karena keduanya memiliki fungsi yang hampir saya, saya bisa saja mematikan `systemd-resolved` dan membiarkan DNSCrypt-proxy mengambil-alih semua urusan DNS.  Tapi kali ini, saya akan mencoba konfigurasi dimana `systemd-resolved` meneruskan DNS query ke DNSCrypt-proxy.  Pada konfigurasi ini, dua service tersebut akan berjalan secara bersamaan dimana `systemd-resolved` akan diakses secara langsung oleh sistem operasi.  Di balik layar, `systemd-resolved` akan meneruskan request DNS ke DNSCrypt-proxy.

Karena DNSCript-proxy harus berjalan terlebih dahulu sebelum `systemd-resolved`, saya menambahkan baris berikut ini di `/etc/systemd/system/dnscrypt-proxy.service`:

```
Before=systemd-resolved.service
```

Setelah itu, saya mengubah baris `DNS` pada file `/etc/systemd/resolved.conf` sehingga menjadi seperti berikut ini:

```
DNS=127.0.0.54
```

Baris di atas akan mengatur DNS secara global.  Selain itu, saya juga melakukan pengaturan secara spesifik pada *network card* yang saya pakai.  Saya memastikan bahwa pada  Network Manager, saya tidak meggunakan DNS dari DHCP (yang biasanya merujuk pada router seperti `192.168.1.1`) melainkan `127.0.0.54`.  Setelah menjalankan ulang `systemd-resolved` dengan perintah `systemctl restart systemd-resolved`, saya memberikan perintah `systemd-resolve --status` untuk melihat DNS yang dipakai.  Saya memastikan bahwa hasil dari perintah di atas meunjukkan DNS yang dipakai adalah `127.0.0.54`.

Proses instalasi sampai disini sudah selesai! Untuk membuktikan bahwa DNSCrypt-proxy bekerja, saya bisa memberikan perintah berikut ini:

> $ <strong>dig txt maxmind.test-ipv6.com</strong>

```
; <<>> DiG 9.11.3-1ubuntu1-Ubuntu <<>> txt maxmind.test-ipv6.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 43426
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 65494
;; QUESTION SECTION:
;maxmind.test-ipv6.com.   IN  TXT

;; ANSWER SECTION:
maxmind.test-ipv6.com.  599 IN  TXT "ip='2400:cb00:35:1024::ac44:9174' as='13335' isp='Cloudflare, Inc.' country='US'"

;; Query time: 234 msec
;; SERVER: 127.0.0.53#53(127.0.0.53)
;; WHEN: Sat May 26 15:01:13 WIB 2018
;; MSG SIZE  rcvd: 143
```

Terlihat bahwa kali ini *name server* dihubungi secara langsung oleh Cloudfare dan bukan lagi oleh *DNS resolver* milik ISP.