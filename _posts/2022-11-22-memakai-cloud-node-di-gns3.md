---
layout: post
category: Network
title: Memakai Cloud Node di GNS3
tags: [GNS3]
---

*Cloud node* adalah salah satu fitur yang sangat berguna di GNS3.  Dengan *cloud node* tersebut, saya dapat menghubungkan jaringan 
yang disimulasikan ke jaringan lainnya yang berada di luar GNS3 seperti Internet, perangkat virtual, termasuk dengan jaringan
di simulasi proyek GNS3 lainnya.  Pada artikel ini, saya akan mencoba beberapa variasi penggunaan *cloud node* tersebut.

#### Menggunakan *cloud node* untuk terhubung ke Internet

Ini adalah salah bentuk penerapan yang paling sederhana.  Sebagai contoh, saya bisa membuat topologi seperti berikut ini:

![Terhubung Ke Internet]({{ "/assets/images/gambar_00085.png" | relative_url}}){:class="img-fluid rounded"}

Pada diagram di atas, saya menghubungkan `PC1` ke kartu jaringan yang sama dengan yang saya pakai untuk mengakses Internet
(terhubung ke *router* fisik).  Karena pada umumnya *router* fisik sudah menyediakan DHCP, saya dapat menggunakannya untuk 
mendapatkan alamat IP di `PC1` seperti pada perintah berikut ini:

> <strong>PC1></strong> <code>dhcp</code>

```
DDORA IP 192.168.1.2/24 GW 192.168.1.1
```

> <strong>PC1></strong> <code>ping 8.8.8.8</code>

```
84 bytes from 8.8.8.8 icmp_seq=1 ttl=150 time=10.066 ms
84 bytes from 8.8.8.8 icmp_seq=2 ttl=150 time=11.864 ms
84 bytes from 8.8.8.8 icmp_seq=3 ttl=150 time=11.914 ms
84 bytes from 8.8.8.8 icmp_seq=4 ttl=150 time=10.929 ms
```

Pada konfigurasi seperti ini, *router* fisik akan melihat `PC1` sebagai sebuah perangkat baru.  *Router* fisik akan memberikan
alamat IP melalui DHCP ke `PC1` secara langsung.  Setelah itu, `PC1` dapat mengakses Internet sama seperti komputer *host*.  Pola 
komunikasi ini mirip seperti modus **NAT networking** di VirtualBox.

#### Mengakses jaringan di GNS3 dari host melalui `virbr0`

Pada saat men-*double click* *cloud node*, saya dapat menambahkan tanda centang pada **Show special Ethernet interfaces** untuk 
menampilkan perangkat virtual seperti `lo` dan `virbr0` seperti yang terlihat pada gambar berikut ini:

![Menampilkan Perangkat Virtual]({{ "/assets/images/gambar_00086.png" | relative_url}}){:class="img-fluid rounded"}

Perangkat `virbr0` dari `libvirt` sudah dilengkapi dengan DHCP dan dapat diakses dari komputer *host* yang menjalankan GNS3. Untuk
menggunakanya, saya memilih `virbr0` dan men-klik tombol **Add**.

Kali ini saya akan mencoba membuat sebuah Virtual PC baru berdasarkan *image* Docker yang dibuat dari `Dockerfile` berikut ini:

```dockerfile
FROM ubuntu/nginx:latest
RUN apt-get update && apt-get install -y isc-dhcp-client netcat-openbsd curl
```

Untuk menghasilkan *image* dari file di atas, saya dapat memberikan perintah seperti:

> <strong>#</strong> <code>docker build -t ubuntu/nginx:latest .</code>

Setelah itu, saya dapat mendaftarkan *image* tersebut sebagai sebuah Virtual PC di GNS3 dengan memilih menu **Edit**, **Preferences...**,
dan memilih **Docker**, **Docker containers** dari menu yang ada.  Pada halaman yang muncul, saya dapat meilih nama *image* yang saya
buat di atas.  Ini akan mendaftarkan sebuah VPC baru yang menjalankan web server NGINX  dan sudah dilengkapi DHCP client dan *tool* tambahan
seperti `nc` dan `curl`.

Saya dapat menghubungkan VPC ini ke sebuah *cloud node* seperti yang terlihat pada gambar berikut ini:

![Server NGINX di GNS3]({{ "/assets/images/gambar_00087.png" | relative_url}}){:class="img-fluid rounded"}

Setelah menjalankan topologi, untuk mendapatkan alamat IP dari *cloud node* lewat DHCP, saya men-klik kanan *node* `ubuntu-nginx-1` dan 
memilih menu **Auxiliary console**.  Pada terminal yang muncul, saya memberikan perintah seperti berikut ini:

> <strong>#</strong> <code>dhclient</code>

> <strong>#</strong> <code>ip -br address show dev eth0</code>
```
eth0             UNKNOWN        192.168.122.153/24 
```

Saya dapat menggunakan alamat ini di komputer *host* yang menjalankan GNS3 untuk mengakses layanan NGINX yang berada di dalam
GNS3, seperti yang terlihat pada perintah berikut ini:

> <strong>#</strong> <code>curl http://192.168.122.153</code>

Terlihat bahwa *cloud node* memungkinkan saya berperan sebagai pengguna eksternal (dari komputer *host*) untuk mengakses jaringan
yang disimulasikan di dalam GNS3.

#### Mengakses jaringan di host melalui `virbr0`

Ini adalah kebalikan dari skenario sebelumnya.  Pada kasus ini, saya akan menjalankan *container* NGINX di komputer *host*
dengan perintah seperti berikut ini:

> <strong>$</strong> <code>docker run -p 192.168.122.1:80:80 --name nginx ubuntu/nginx:latest</code>

Setelah itu, saya akan membuat topologi seperti pada gambar berikut ini:

![Mengakses server NGINX di host]({{ "/assets/images/gambar_00088.png" | relative_url}}){:class="img-fluid rounded"}

Pada `PC1`, saya dapat mengakses server NGINX yang sudah saya jalankan di *host* dengan memberikan perintah seperti berikut ini:

> <strong>#</strong> <code>dhclient</code>
> 
> <strong>#</strong> <code>curl http://192.168.122.1</code>

Saya juga dapat memberikan perintah yang sama di `PC2` untuk mengakses server NGINX yang ada di *host* karena `PC2` juga terhubung
ke *cloud node*.  Terlihat bahwa *cloud node* memungkinkan jaringan yang berada di dalam GNS3 untuk mengakses layanan nyata di komputer
*host* seperti *web server* dan *database* yang permanen. 


#### Mengakses *cloud node* di proyek GNS3 berbeda

Untuk menghubungkan dua *cloud node* di proyek berbeda (atau di komputer berbeda), saya dapat menggunakan fasilitas *UDP tunnel*.  Sebagai contoh,
saya men-*double klik* *cloud node* dan memilih tab **UDP tunnels**.  Setelah itu, saya men-klik tombol **Add** untuk menambahkan
*UDP tunnel* seperti yang terlihat pada gambar berikut ini:

![Konfigurasi UDP tunnel di proyek pertama]({{ "/assets/images/gambar_00089.png" | relative_url}}){:class="img-fluid rounded"}

Pada pengaturan di atas, *UDP tunnel* akan membuka *port* lokal di `30000` dan melakukan koneksi ke *port* lain di `20000`.

Kemudian, sebagai latihan, saya akan menambahkan sebuah server NGINX di proyek ini, seperti yang terlihat pada gambar berikut ini:

![Proyek dengan server NGINX]({{ "/assets/images/gambar_00090.png" | relative_url}}){:class="img-fluid rounded"}

Berbeda dengan `virbr0`, tidak ada fasilitas DHCP di *UDP tunnel* sehingga saya perlu menambahkan alamat IP secara manual dengan 
memberikan perintah berikut ini di `ubuntu-nginx-1`:

> <strong>#</strong> <code>ip address add 192.168.44.55/24 dev eth0</code>

Berikutnya, saya akan membuka proyek GNS3 yang baru dan menambahkan *cloud node* dengan konfigurasi *UDP tunnel* seperti pada
gambar berikut ini:

![Konfigurasi UDP tunnel di proyek kedua]({{ "/assets/images/gambar_00091.png" | relative_url}}){:class="img-fluid rounded"}

Nilai *remote port* yang saya pakai adalah nilai *local port* pada proyek pertama.  Begitu juga dengan nilai *local port* yang saya 
pakai yang merupakan nilai *remote port* di proyek pertama.  Dengan kedua nilai yang saling berkebalikan ini, saya sudah 
menghubungkan dua *cloud node* yang berbeda.  Agar terlihat lebih jelas, saya kemudian membuat topologi seperti pada gambar berikut ini:

![Proyek client]({{ "/assets/images/gambar_00092.png" | relative_url}}){:class="img-fluid rounded"}

Pada `PC1`, saya kemudian memberikan perintah seperti berikut ini:

> <strong>#</strong> <code>ip address add 192.168.44.56/24 dev eth0</code>

> <strong>#</strong> <code>curl http://192.168.44.55</code>

Terlihat bahwa `PC1` dapat menghubungi `ubuntu-nginx-1` yang berada di proyek berbeda.  Saya juga dapat melakukan hal yang sama
dari `PC2`:

> <strong>#</strong> <code>ip address add 192.168.44.57/24 dev eth0</code>

> <strong>#</strong> <code>curl http://192.168.44.55</code>

Terlihat bahwa dengan fasilitas *UDP tunnel*, saya dapat menghubungkan dua *cloud node* yang berada di luar batasan proyek, termasuk
 dua proyek GNS3 yang berjalan di komputer *host* berbeda.