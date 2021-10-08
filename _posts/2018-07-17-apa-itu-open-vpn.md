---
layout: post
category: Network
title: Apa Itu OpenVPN?
tags: [OpenVPN]
---

Virtual Private Network (VPN) adalah sesuatu yang menghubungkan dua jaringan berbeda melalui jaringan publik (*public network*) sehingga pengguna seolah-olah berada dalam jaringan yang sama (*virtual*).  Karena data yang dikirim atau diterima dari dua jaringan yang dihubungan harus dikirim melalui *public network*, VPN memiliki mekanisme untuk mengamankan data.  Kini, berkat fitur keamanan tersebut, VPN sering dipakai untuk mencegah penyadapan dan sensor dari pihak ketiga (serangan *man in the middle*).

Bukankah dengan menggunakan HTTPS, pihak ketiga juga tidak mengetahui data yang sedang dikirim?  Memang benar, akan tetapi perlu diingat bahwa HTTPS bekerja pada *application layer*.  Walaupun pihak ketiga tidak mengetahui isi data yang sedang beredar, ia bisa dengan jelas mengetahui kapan komunikasi dilakukan dan siapa tujuannya.  Sebagai perbandingan, VPN membuat *tunnel* dan seluruh aktifitas jaringan akan melalui *tunnel* ini.  Karena *tunnel* ini diamankan oleh VPN, pihak ketiga tidak akan mengetahui apa saja yang beredar.

Ada beberapa jenis implementasi VPN, seperti PPTP, IPSec, OpenVPN, dan sebagainya.  Pada artikel ini, saya akan membahas tentang OpenVPN (kode programnya dapat dijumpai di <https://github.com/OpenVPN/openvpn>).  OpenVPN adalah implementasi VPN yang menggunakan SSL/TLS untuk mengamankan jalur komunikasinya.  Selain itu, OpenVPN menggunakan *virtual network adapter* yang dapat berupa *tun device* (layer-3) atau *tap device* (layer-2).  *Tap device* bisa dipakai bila pengguna ingin bekerja pada protokol selain IP. Secara default, OpenVPN menggunakan protokol UDP di port 1194.  OpenVPN juga dapat bekerja pada port TCP walaupun tidak dianjurkan karena kinerja paket TCP yang dikirim melalui jalur TCP bisa menyebabkan penalti kinerja ganda terutama pada kualitas jaringan yang buruk.  OpenVPN memakai dua jalur komunikasi virtual: *control channel* dan *data channel*.  Kedua jalur ini memiliki di-enkripsi secara berbeda.  Karena kedua jalur komunikasi ini adalah jalur *virtual* yang melalui *multiplexing*, secara kasat mata, yang terlihat tetap komunikasi di satu *socket* (default UDP port 1194) saja.

Konfigurasi OpenVPN yang paling sederhana adalah modus *point-to-point* tanpa enkripsi.  Pada modus ini, fasilitas enkripsi tidak aktif dan OpenVPN hanya menyambungkan dua titik jaringan yang berbeda.  Untuk menggunakannya, pada sisi *server*, saya memberikan perintah berikut ini:

> <strong>$</strong> <code>openvpn --ifconfig 10.8.0.1 10.8.0.2 --dev tun</code>

Kemudian, pada sisi *client*, saya memberikan perintah berikut ini:

> <strong>$</strong> <code>openvpn --ifconfig 10.8.0.2 10.8.0.1 --dev tun --remote x.x.x.x (ganti dengan alamat ip server) --redirect-gateway def1</code>

Dengan asumsi bahwa saya sudah melakukan pengaturan *packet forwarding* dan tabel `MASQUERADE` di *iptables* secara benar di sisi *server*, setelah memberikan perintah di atas, *client* bisa mengakses Internet melalui ip publik milik *server*.  Tentu saja tanpa enkrispi, OpenVPN tidak dapat berfungsi untuk melindungi data dari pihak ketiga (serangan *man in the middle*).

Agar sedikit lebih aman, saya bisa menggunakan *secret key* yang dapat dihasilkan dengan menggunakan perintah seperti berikut ini:

> <strong>$</strong> <code>openvpn --genkey --secret rahasia.key</code>

File `rahasia.key` yang dihasilkan nantinya bisa digunakan sebagai nilai untuk parameter `--secret`.  Walaupun sudah melakukan enkripsi, penggunaan *static key* seperti ini dianggap tidak optimal.  Bagaimana bila saat file ini dipindahkan dari *server* ke *client* (melalui *email*, *flash drive*, dan sejenisnya), pihak ketiga memperoleh salinannya?  Selain itu, bila pihak ketiga merekam seluruh komunikasi *client* dan *server* dari awal, bila ia berhasil memperoleh *static key* di kemudian hari, maka seluruh komunikasi yang telah terekam akan dapat dibaca.  Permasalahan ini disebabkan oleh kurangnya *perfect forward secrecy* (PFS).

Metode enkripsi yang dianggap optimal untuk OpenVPN adalah dengan menggunakan PKI dan sertifikat digital.  Saya tidak perlu memperoleh *root certificate* secara resmi; saya bisa menggunakan proyek Easy-RSA untuk menghasilkan sertifikat yang dibutuhkan.  Saya bisa men-*download* Easy-RSA dari <https://github.com/OpenVPN/easy-rsa/releases>.  Setelah men-*extract* file tersebut, saya men-copy file `vars.example` menjadi `vars` dan melakukan perubahan pada nilai seperti `EASYRSA_REQ_COUNTRY`, `EASYRSA_REQ_PROVICE`, `EASYRSA_REQ_CITY`, `EASYRSA_REQ_ORG`, `EASYRSA_REQ_EMAIL`, dan `EASYRSA_REQ_OU`.  Setelah itu, saya memberikan perintah:


> <strong>$</strong> <code>./easyrsa init-pki</code>

> <strong>$</strong> <code>./easyrsa build-ca</code>


Perintah di atas akan menghasilkan sertifikat CA pada lokasi `pki/ca.crt`.

Sekarang, saatnya menghasilkan sertifikat untuk *server* dan *client* yang di-*sign* oleh sertifikat CA tersebut dengan perintah:


> <strong>$</strong> <code>./easyrsa build-server-full server</code>

> <strong>$</strong> <code>./easyrsa build-client-full client</code>


Sertifikat untuk *server* akan dihasilkan di `pki/issued/server.crt` dan sertifikat untuk *client* dapat dijumpai di `pki/issued/client.crt`.

Berikutnya, saya membuat Diffie-Hellman (DH) key dengan memberikan perintah berikut ini:


> <strong>$</strong> <code>./easyrsa gen-dh</code>


Karena argumen untuk menggunakan sertifikat digital cukup banyak untuk diketik, saya memilih membuat file konfigurasi OpenVPN dengan nama `server.ovpn` yang isinya seperti berikut ini:

```
proto udp
port 1194
dev tun
server 10.8.0.0 255.255.255.0
topology subnet
persist-key
persist-tun
keepalive 10 60

dh /lokasi/ke/file/EasyRSA-3.0.4/pki/dh.pem
ca /lokasi/ke/file/EasyRSA-3.0.4/pki/ca.crt
cert /lokasi/ke/file/EasyRSA-3.0.4/pki/issued/server.crt
key /lokasi/ke/file/EasyRSA-3.0.4/pki/private/server.key
```

Saya kemudian bisa menjalankan OpenVPN di-sisi server dengan memberikan perintah berikut ini:


> <strong>$</strong> <code>openvpn --config server.ovpn</code>


Sekarang, saatnya melakukan konfigurasi di sisi *client*.  Sebelumnya, saya perlu men-copy sertifikat publik CA `ca.crt`, sertifikat publik *client* (`client.crt`) dan *private key* (`client.key`) yang telah dihasilkan sebelumnya ke komputer *client*.  Sebagai contoh, saya bisa menggunakan perintah `scp` di Linux:


> <strong>$</strong> <code>scp user@alamat-ip-server:~/EasyRSA-3.0.4/pki/ca.crt .</code>

> <strong>$</strong> <code>scp user@alamat-ip-server:~/EasyRSA-3.0.4/pki/issued/client.crt .</code>

> <strong>$</strong> <code>scp user@alamat-ip-server:~/EasyRSA-3.0.4/pki/private/client.key .</code>


Satelah itu saya membuat file konfigurasi OpenVPN untuk *client* dengan nama `client.ovpn` yang isinya seperti berikut ini:

```
client
proto udp
remote x.x.x.x (ganti dengan alamat ip server)
port 1194
dev tun
nobind
redirect-gateway def1
ca ca.crt
cert client.crt
key client.key
```

Untuk menjalankan OpenVPN di sisi *client*, saya memberikan perintah berikut ini:


> <strong>$</strong> <code>openvpn --config client.ovpn</code>


Sampai disini, komunikasi dari *client* ke *server* sudah ter-enkripsi menggunakan sertifikat digital.  Walaupun demikian, masih ada celah keamanan yang dapat diperbaiki.  Sebagai contoh, bagaimana bila pihak ketiga melakukan serangan *man in the middle* dengan berpura-pura menjadi *server* saya (padahal hanya meneruskan request dari *client* ke *server* yang sesungguhnya)?

Untuk mengatasinya, saya bisa menambahkan baris berikut ini pada `server.ovpn`:

```
remote-cert-tls client
```

dan baris berikut ini pada `client.ovpn`:

```
remote-cert-tls server
```

Pada saat saya menggunakan perintah Easy-RSA `build-client-full` dan `build-server-full`, sertifikat yang dihasilkan memiliki atribut Extended Key Usage (EKU) yang menunjukkan bahwa sertifikat tersebut digunakan hanya untuk *client* atau hanya untuk *server*.  Konfigurasi `remote-cert-tls` menandakan bahwa OpenVPN harus memeriksa nilai EKU dari sertifikat yang dipergunakan.

Perlu di-ingat bahwa fasilitas enkripsi yang ditawarkan oleh OpenVPN adalah sebatas pada *tunnel* yang menghubungkan *client* ke *server*.  Bila *client* terhubung ke *server* melalui ISP, maka OpenVPN melindungi supaya ISP tidak bisa melihat atau mengubah komunikasi tersebut.  OpenVPN tidak akan melindungi data yang keluar dari *server* ke alamat Internet tujuan.  Dengan demikian, ISP yang dipakai oleh *server*  dapat melihat semua komunikasi dari *client*.  Membuat dan memakai *server* OpenVPN sendiri yang terhubung ke ISP terpercaya akan jauh lebih aman daripada memakai layanan OpenVPN dari pihak ketiga (terutama yang gratis!).