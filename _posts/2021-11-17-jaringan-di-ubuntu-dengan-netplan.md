---
layout: post
category: Network
title: Konfigurasi Jaringan Di Ubuntu Dengan Netplan
tags: [Ubuntu]
---

Pada suatu hari, saya ingin melakukan konfigurasi sederhana di *server* Ubuntu.  Saya ingin mengubah yang sebelumnya menggunakan DHCP menjadi alamat statis dan memakai DNS yang saya tentukan.  Seperti biasanya, saya segera melakukan pencarian di Google.  Namun, semakin banyak membaca hasil pencarian yang muncul, saya semakin bingung apa yang harus dilakukan.  Saya menemukan beberapa kata kunci seperti NetworkManager, systemd-networkd, dan Netplan, namun tidak mendapatkan penjelasan yang berarti mengenai seperti apa hubungan mereka dan mana yang harus saya pakai.  Saya pun melakukan sedikit riset untuk mencari tahu jawaban ini.

### Konfigurasi Jaringan Klasik

<div class="alert alert-warning" role="alert">
<strong>PENTING:</strong> Cara ini tidak berlaku lagi di Ubuntu modern.  Perubahan pada file konfigurasi di bawah ini akan diabaikan atau ditulis ulang pada saat status jaringan berubah. 
</div>

Setelah *bootloader* selesai dikerjakan, sistem operasi harus menjalankan sebuah program pertama yang berperan untuk menyiapkan komponen sistem operasi lainnya.  Pada distro Linux modern, program pertama ini umumnya adalah systemd.  Komponen yang menangani jaringan di systemd adalah systemd-networkd.  Walaupun demikian, masih ada juga distro yang **tidak** memakai systemd secara *default* seperti Alpine Linux yang menggunakan OpenRC.

Untuk mengaktifkan jaringan di Alpine Linux, saya perlu membuat file `/etc/network/interfaces` dengan isi seperti berikut ini:

```
auto eth0
iface eth0 inet dhcp
```

Setelah itu, ada beberapa alternatif perintah yang dapat saya berikan untuk mengaktifkan konfigurasi ini.  Bila saya hanya ingin mengaktifkan jaringan `eth0`, saya dapat memberikan perintah seperti:

> <strong>#</strong> <code>ifup eth0</code>

Alternatif lainnya, untuk mengatifkan seluruh kartu jaringan yang ada, saya dapat memberikan perintah:

> <strong>#</strong> <code>/etc/init.d/networking start</code>

atau

> <strong>#</strong> <code>rc-service networking start</code>

Setelah ini, saya sudah bisa memakai jaringan dengan baik.

Bagaimana bila saya tidak ingin menggunakan DHCP dan ingin memberikan pengaturan secara statis?  Saya bisa mengubah isi `/etc/network/interfaces` menjadi seperti berikut ini:

```
auto eth0
iface eth0 inet static
    address 192.168.1.5
    gateway 192.168.1.1
```

Untuk mengatur DNS server yang akan dipakai, saya dapat membuat file `/etc/resolv.conf` dengan isi seperti berikut ini:

```
nameserver 8.8.8.8
nameserver 4.4.4.4
```

Setelah itu, saya men-*restart* jaringan dengan perintah seperti berikut ini:

> <strong>#</strong> <code>/etc/init.d/networking restart</code>

Sangat sederhana dan mudah dimengerti, bukan?  Walaupun demikian, pengaturan seperti ini tidak disarankan lagi di sistem operasi seperti Ubuntu modern.  Bila saya melihat isi file `/etc/network/interfaces` di Ubuntu, saya akan menemukan bahwa file tersebut tidak lagi berisi konfigurasi selain komentar peringatan seperti:

```
# ifupdown has been replaced by netplan(5) on this system.  See
# /etc/netplan for current configuration.
# To re-enable ifupdown on this system, you can run:
#    sudo apt install ifupdown
```

Untuk `/etc/resolv.conf`, walaupun terdapat nilai konfigurasi `nameserver`, beberapa baris pertama-nya berisi komentar peringatan seperti berikut ini:

```
# This file is managed by man:systemd-resolved(8). Do not edit.
```

Ini berarti bila saya menemukan panduan jaringan Linux yang melakukan pengaturan dengan menulis ke dua file tersebut, saya harus segera mencari ulang lagi panduan baru yang lebih tepat untuk sistem operasi Ubuntu yang saya pakai. 

### Konfigurasi Jaringan Dengan NetworkManager

NetworkManager adalah sebuah utilitas yang diciptakan untuk mempermudah menangani koneksi jaringan di Linux.  Utilitas ini lebih sering digunakan oleh distro untuk *desktop*.  Sebagai contoh, pada saat saya melakukan konfigurasi jaringan di *control center* di Ubuntu (secara GUI), konfigurasi yang dipakai adalah konfigurasi untuk NetworkManager.  Ini adalah *default* untuk Ubuntu versi *desktop*.  Pada versi *server*, pengaturan jaringan dilakukan oleh systemd-networkd tanpa melalui NetworkManager.  

NetworkManager sebenarnya tidak tergantung pada systemd-networkd.  Untuk membuktikannya, saya akan melakukan instalasi NetworkManager di Alpine Linux yang secara bawaan tidak menggunakan systemd.  Untuk itu, saya memberikan perintah berikut ini di Alpine Linux:

> <strong>#</strong> <code>cat > /etc/apk/repositories << EOF; $(echo)

> <code>http://dl-cdn.alpinelinux.org/alpine/v$(cat /etc/alpine-release | cut -d'.' -f1,2)/main</code>

> <code>http://dl-cdn.alpinelinux.org/alpine/v$(cat /etc/alpine-release | cut -d'.' -f1,2)/community</code>

> <code>EOF</code>

> <strong>#</strong> <code>apk update</code>

> <strong>#</strong> <code>apk add networkmanager</code>

Setelah instalasi selesai, saya dapat menjalankan NetworkManager dengan memberikan perintah berikut ini:

> <strong>#</strong> <code>rc-service networkmanager start</code>

Walaupun umumnya lebih sering digunakan untuk GUI dengan menggunakan `nm-connection-editor` atau `network-manager-applet`, saya juga bisa mengakses NetworkManager di terminal dengan menggunakan `nmcli`.

Untuk melihat perangkat jaringan apa saja yang dikelola oleh NetworkManager, saya dapat memberikan perintah:

> <strong>#</strong> <code>nmcli device</code>

Baris yang berwarna abu-abu dengan status `unmanaged` menunjukkan perangkat tersebut tidak dikelola oleh NetworkManager.

Salah satu contoh dimana NetworkManager menyederhanakan konfigurasi jaringan adalah saya dapat menentukan DNS global yang akan dipakai.  NetworkManager akan memantau perubahan di jaringan dan mengisi nilai `/etc/resolv.conf` sesuai dengan yang saya berikan walaupun nilainya telah berubah (misalnya akibat pengaturan dari DHCP).  Untuk menentukan DNS global, saya akan membuat file `/etc/NetworkManager/conf.d/dns-servers.conf` dengan isi seperti berikut ini:

```
[global-dns-domain-*]
servers=8.8.8.8,4.4.4.4
```

Kemudian, saya memberikan perintah:

> <strong>#</strong> <code>nmcli general reload</code>

Sekarang, bila saya membuka file `/etc/resolv.conf`, saya akan menemukan isi seperti:

> <strong>#</strong> <code>cat /etc/resolv.conf</code>

```
# Generated by NetworkManager
nameserver 8.8.8.8
nameserver 4.4.4.4
```

Terlihat bahwa isi file ini kini di-*"kelola"* oleh NetworkManager.  Ini juga berarti saya tidak perlu (dan tidak **seharusnya**) mengubah file `/etc/resolv.conf` secara langsung lagi.

<div class="alert alert-warning" role="alert">
<strong>PENTING:</strong> Salah satu sumber kebingungan yang paling sering terjadi adalah mengikuti tutorial jaringan klasik yang mengubah file seperti <code>/etc/resolv.conf</code> secara langsung, namun setelah komputer di-<em>restart</em>, perubahan pada file tersebut hilang.  Hal ini menunjukkan bahwa jaringan dikelola oleh utilitas yang menawarkan abstraksi lebih tinggi seperti NetworkManager.   
</div>

Karena saya ingin melakukan konfigurasi pada sistem operasi Ubuntu untuk *server* yang tidak menggunakan NetworkManager, saya tidak dapat mengikuti panduan dari artikel yang menyebutkan *tool* seperti `nmcli` atau `nmtui`.

<div class="alert alert-warning" role="alert">
<strong>PENTING:</strong> Bila menemukan artikel di web yang menggunakan instruksi seperti <code>nmcli</code> atau <code>nmtui</code> untuk Ubuntu, pastikan bahwa NetworkManager sudah ter-<em>install</em> dan perangkat jaringan dikelola oleh NetworkManager.  Walaupun sama-sama Ubuntu, berbeda dengan distribusi untuk <em>desktop</em>, pada distribusi untuk <em>server</em>, jaringan secara <em>default</em> dikelola oleh systemd-networkd.   
</div>

### Konfigurasi Jaringan Dengan systemd-networkd

Pada sistem operasi yang menggunakan systemd, komponen jaringan biasanya ditangani oleh networkd.  Sebagai contoh, pada sistem operasi Ubuntu untuk *server* (seperti yang disediakan oleh *cloud platform*), saya akan menemukan file konfigurasi untuk setiap perangkat jaringan di `/etc/systemd/networks`.  Kenapa harus berbeda dari *desktop*?  Kenapa *desktop* harus menggunakan NetworkManager?  Hal ini karena pada sistem operasi *desktop*, pengguna akan sering melakukan perubahan jaringan seperti melakukan koneksi Wifi ke *access point* baru, melakukan *tethering*, dan sebagainya.  Walaupun systemd-networkd lebih baru, ia tidak memiliki dukungan GUI seperti NetworkManager. Memaksa pengguna untuk mengetikkan file konfigurasi hanya untuk melakukan koneksi ke Wifi baru bukanlah sesuatu yang *user friendly*.  Namun lain halnya di sisi *server*: tidak ada GUI disini sehingga menulis file konfigurasi dan mengetikkan perintah di *terminal* adalah hal sehari-hari.

systemd-networkd tidak memiliki CLI yang lengkap seperti `nmcli` yang dipakai NetworkManager.  Ia juga tidak memiliki GUI untuk melakukan pengaturan konfigurasi secara visual.  Satu-satunya yang bisa saya lakukan adalah memberikan perintah `networkctl` untuk melihat perangkat apa saja yang dikelola oleh systemd-networkd:

> <strong>$</strong> <code>networkctl</code>

Baris berwarna hijau dengan status `configured` menunjukkan bahwa perangkat tersebut dikelola oleh systemd-networkd.

Khusus untuk DNS, systemd memiliki komponen yang disebut sebagai resolved.  Pada Ubuntu untuk *desktop*, salah satu bagian yang cukup membingungkan adalah walaupun jaringan dikelola oleh NetworkManager, DNS tetap ditangani oleh systemd-resolved.  Sesungguhnya ini adalah *"fitur"* dari NetworkManager.  Bila `/etc/resolv.conf` adalah *symbolic link* ke `/run/systemd/resolve/stub-resolv.conf` atau terdapat nilai `dns=systemd-resolved` di file konfigurasinya, maka NetworkManager tidak akan menimpa file `/etc/resolv.conf`.  Sebagai gantinya, ia akan mengatur DNS di `systemd-resolved` untuk perangkat tersebut.

Untuk melihat informasi DNS yang dipakai oleh `systemd-resolved`, saya dapat menggunakan perintah:

> <strong>$</strong> <code>resolvectl</code>

Karena *server* Ubuntu yang saya pakai menggunakan networkd, sebenarnya saya bisa mengikuti *tutorial* di artikel yang menggunakan systemd-networkd.  Walaupun demikian, pada kondisi tertentu, konfigurasi yang sudah saya buat suatu saat bisa *"hilang"* atau *"berubah"* sendiri.  Hal ini karena Ubuntu memiliki sebuah abstraksi lebih tinggi lagi berupa sebuah utilitas buatan Canonical yang disebut sebagai Netplan.

### Konfigurasi Jaringan Dengan Netplan

Berbeda dengan NetworkManager atau systemd-networkd, Netplan bukanlah layanan jaringan.  Netplan hanya sebuah *tool* untuk menghasilkan konfigurasi untuk NetworkManager atau systemd-networkd berdasarkan konfigurasi tunggal yang ditulis format YAML.  Dengan demikian, pengguna hanya perlu mempelajari sintaks konfigurasi YAML dari Netplan tanpa harus menyentuh konfigurasi NetworkManager ataupun systemd-networkd secara langsung.  Untuk berpindah dari NetworkManager ke systemd-networkd (dan sebaliknya), pengguna cukup memberikan nilai `NetworkManager` atau `networkd` ke `renderer`.

File konfigurasi Netplan dapat dijumpai di folder `/etc/netplan`.  Pada sistem operasi Ubuntu untuk *desktop*, saya hanya menjumpai sebuah file dengan dengan isi seperti berikut ini:

```yaml
# Let NetworkManager manage all devices on this system
network:
  version: 2
  renderer: NetworkManager
```

Sesuai dengan namanya, konfigurasi di atas akan menggunakan konfigurasi dari NetworkManager apa adanya.

Pada sistem operasi Ubuntu untuk *server*, saya akan menemukan file YAML dengan isi seperti berikut ini:

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      dhcp4: yes
```

Terlihat bahwa `renderer` yang dipakai untuk versi *server* adalah `networkd`.

Kembali ke pertanyaan awal saya, cara yang paling disarankan untuk sistem operasi Ubuntu *server* untuk melakukan pengaturan seperti alamat IP dan DNS adalah dengan mengubah file konfigurasi di `/etc/netplan`.  Oleh sebab itu, saya akan mengubah file YAML di folder tersebut menjadi seperti berikut ini:

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      addresses:
        - 192.168.1.5/24
      nameservers:
        addresses: [8.8.8.8, 4.4.4.4]
      gateway4: 192.168.1.1
```

Saya kemudian memberikan perintah berikut ini untuk mengaplikasikan file konfigurasi tersebut:

> <strong>$</strong> <code>sudo netplan apply</code>

Tidak lama kemudian, saat memberikan perintah `ip addr`, saya akan menemukan bahwa `eth0` sudah menggunakan alamat IP `192.168.1.5`.  Begitu juga saat saya memberikan perintah `resolvectl`, saya akan menemukan bahwa *request* dari `eth0` akan menggunakan DNS `8.8.8.8` dan `4.4.4.4`.  Bila perubahan belum juga terjadi, saya dapat memberikan perintah `ip link set eth0 down` dan `ip link set eth0 up` untuk menjalankan ulang perangkat jaringan.