---
layout: post
category: Network
title: Menggunakan OpenVPN Untuk Menghubungkan Dua Jaringan Berbeda
tags: [Ubuntu, OpenVPN]
---

Salah satu metode yang paling umum dipakai untuk menghubungkan dua jaringan di lokasi fisik yang berbeda melalui
Internet adalah dengan mengunakan VPN.  Dengan menambahkan VPN gateway, masing-masing perangkat lokal di jaringan
berbeda dapat saling berkomunikasi seolah-olah mereka terhubung secara lokal di jaringan yang sama.  Walaupun biasanya
VPN gateway berbentuk perangkat fisik yang ter-integrasi dengan *router*, pada artikel ini, saya akan mencoba menggunakan
sebuah PC dengan sistem operasi Ubuntu Server untuk dijadikan VPN gateway.

Sebagai contoh, anggap saja terdapat dua jaringan di rumah berbeda yang terhubung ke Internet melalui *router* OpenWRT
bawaan ISP rumahan seperti yang terlihat pada topologi GNS3 berikut ini:

![Topologi Jaringan Awal]({{ "/assets/images/gambar_00093.png" | relative_url}}){:class="img-fluid rounded"}

Karena saya menggunakan UDP tunnel di *cloud node* untuk mensimulasikan Internet, tidak ada fasilitas DHCP sehingga
saya perlu memberikan alamat IP statis di `router-rumah1` dan `router-rumah2`.   Karena kedua *router* tersebut adalah
*router* OpenWRT, saya dapat mengubah file `/etc/config/network` pada bagian konfigurasi `wan` di `router-rumah1` agar 
terlihat seperti pada kode berikut ini:

```
...
config interface 'wan'
    option device 'eth1'
    option proto 'static'
    option ipaddr '10.0.0.1'
    option netmask '255.0.0.0'
...
```

Setelah itu, saya dapat menerapkan konfigurasi di atas dengan memberikan perintah:

> <strong>#</strong> <code>service network restart</code>

Saya juga melakukan hal yang sama dengan `router-rumah2` tapi dengan menggunakan IP yang berbeda seperti yang terlihat 
pada kode berikut ini:

```
...
# Untuk router-rumah-2
config interface 'wan'
    option device 'eth1'
    option proto 'static'
    option ipaddr '10.0.0.2'
    option netmask '255.0.0.0'
...
```

Saya memastikan bahwa `router-rumah1` dapat menghubungi IP `router-rumah2` di `10.0.0.2`.  Begitu juga
sebaliknya, `router-rumah2` harus bisa menghubungi IP `router-rumah1` di `10.0.0.1`.  Sampai disini, saya sudah 
mensimulasikan dua buah *router* rumah yang saling terhubung (seolah-olah melalui IP publik di Internet).

Pada topologi seperti ini, bila saya menggunakan perintah `ping`, saya akan menemukan bahwa:
* `PC1` dapat menghubungi `PC2` dan `router-rumah2`.
* `PC2` dapat menghubungi `PC1` dan `router-rumah2`.
* `PC3` dapat menghubungi `PC4` dan `router-rumah1`.
* `PC4` dapat menghubungi `PC3` dan `router-rumah1`.

`PC1` dan `PC2` tidak dapat menghubungi `PC3` dan `PC4`. Begitu juga sebaliknya, `PC3` dan `PC4` tidak dapat menghubungi
`PC1` dan `PC2`.  Bagaimana bila saya menginginkan mereka dapat saling berkomunikasi satu dengan yang lainnya? Agar pola komunikasi 
tersebut terwujud, saya akan mencoba menambahkan komponen OpenVPN sehingga topologinya kini akan terlihat seperti pada gambar berikut ini:

![Topologi Jaringan Dengan VPN Gateway]({{ "/assets/images/gambar_00094.png" | relative_url}}){:class="img-fluid rounded"}

---

#### Konfigurasi Umum pada Ubuntu Server

Saya akan mulai dengan melakukan instalasi Ubuntu Server pada mesin `ovpn-client` dan `ovpn-server`.  Saya dapat men-*download* 
*image* yang dibutuhkan di <https://ubuntu.com/download/server>.  Sesuai dengan namanya, Ubuntu Server adalah variasi Ubuntu yang ditujukan
untuk instalasi di mesin server.  Berbeda dari Ubuntu biasanya, Ubuntu Server tidak dilengkapi dengan GUI, jaringan juga tidak
dikelola oleh NetworkManager, bahkan proses instalasi dilakukan berbasis teks.

Setelah selesai melakukan instalasi Ubuntu Server di mesin virtual QEMU, saya kemudian melakukan instalasi aplikasi yang dibutuhkan
dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>sudo apt update && sudo apt upgrade</code>

> <strong>$</strong> <code>sudo apt install isc-dhcp-server openvpn</code>

Karena server ini akan menjadi *gateway*, saya juga akan mengubah isi file `/etc/sysctl.conf` dengan menambahkan baris berikut ini
untuk mengaktifkan IP forwarding:

```
net.ipv4.ip_forward=1
```

Selain itu, saya juga akan membuat file key statis untuk komunikasi OpenVPN dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>openvpn --genkey secret static.key</code>

Setelah ini, saya dapat menambahkan mesin virtual QEMU tersebut sebagai *node* di topologi GNS3 dengan memilih menu **Edit**,
**Preferences**, dan **QEMU**.  Pada halaman konfigurasi yang ada, saya memastikan bawah jumlah *network adapter* untuk perangkat
 virtual ini adalah dua (2).

---

#### Konfigurasi pada Server OpenVPN

Saya akan mulai dengan melakukan konfigurasi jaringan di `netplan` dengan menambahkan file `/etc/netplan/99-config.yaml` dengan
isi seperti berikut ini:

```yaml
network:
  version: 2
  ethernets:
    ens4:
      dhcp4: true
    ens5:
      addresses:
       - 192.168.200.1/24
```

Pada konfigurasi di atas, `ens4` akan mendapatkan IP otomatis dari `router-rumah2` melalui DHCP.  `ens5` akan diaktifkan dengan
alamat statis `192.168.200.1`.  Untuk menerapkan perubahan pada konfigurasi di atas, saya memberikan perintah berikut ini:

> <strong>$</strong> <code>sudo netplan apply</code>

Setelah ini, saya akan melakukan konfigurasi DHCP server pada perangkat `ens5` yang akan memberikan alamat IP kepada `PC3` dan `PC4`.  Untuk itu,
saya menambahkan baris berikut ini pada `/etc/dhcp/dhcpd.conf`:

```
...
subnet 192.168.200.0 netmask 255.255.255.0 {
   range 192.168.200.10 192.168.200.20;
   option routers 192.168.200.1;
}
...
```

Selain itu, saya juga mengubah file `/etc/default/isc-dhcp-server` menjadi seperti berikut ini:

```
INTERFACESv4="ens5"
INTERFACESv6="ens5"
```

Saya kemudian menerapkan perubahan ini dengan memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>sudo service isc-dhcp-server restart</code>

Sekarang, bila saya memberikan perintah `ip dhcp` pada `PC3` ataupun `PC4`, saya akan mendapatkan alamat IP seperti yang terlihat pada:

> <strong>PC3></strong> <code>ip dhcp</code>
```
DDORA IP 192.168.200.10/24 GW 192.168.200.1
```

Agar `PC3` dan `PC4` dapat menghubungi dunia luar yang memiliki IP diluar `192.168.200.0/24` seperti `router-rumah1` di `10.0.0.1`, saya
akan mengaktifkan NAT di `iptables` dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>sudo iptables -t nat -A POSTROUTING -o ens4 -j MASQUERADE</code>

Walaupun sederhana dan tepat untuk percobaan sederhana seperti di tulisan ini, hasil dari perintah di atas tidak permanen 
sehingga saya perlu memberikan perintah yang sama setiap kali menjalankan ulang topologi.  

Berikutnya, saya akan melakukan konfigurasi OpenVPN.  Karena `ovpn-server` akan menjadi server OpenVPN, saya membuat file konfigurasi
OpenVPN dengan nama `server.ovpn` yang memiliki isi seperti berikut ini:

```
dev tun
local 192.168.1.196
ifconfig 10.1.0.2 10.1.0.1
secret static.key
route 192.168.200.0 255.255.255.0 192.168.200.1
route 192.168.100.0 255.255.255.0 10.1.0.2
```

Saya kemudian dapat menjalankan OpenVPN dengan memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>sudo openvpn server.ovpn</code>

Khusus untuk pada sisi server, saya perlu melakukan sebuah langka ekstra karena server `ovpn-server` berada di balik 
`router-rumah2` sehingga tidak dapat diakses secara langsung dari publik.  Yang memiliki IP publik (sehingga dapat dihubungi
dari luar melalui Internet) hanyalah `router-rumah2`.  Oleh sebab itu, saya perlu menambahkan konfigurasi di OpenWRT supaya 
meneruskan koneksi di port `1194` (untuk OpenVPN) ke jaringan lokal (yang saat ini hanya terhubung ke server OpenVPN `ovpn-server`). 
Untuk itu, saya melakukan perubahan pada file `/etc/config/firewall` dengan menambahkan baris seperti berikut ini:

```
...
config redirect
   option src wan
   option src_dport 1194
   option dest lan
   option dest_port 1194
   option proto udp
...
```

Untuk mengaktifkan konfigurasi di atas, saya dapat memberikan perintah berikut ini:

> <strong>#</strong> <code>service firewall restart</code>

Sampai disini, konfigurasi di sisi *server* sudah siap.  Saatnya untuk melanjutkan ke konfigurasi di sisi klien.

---

#### Konfigurasi pada Klien OpenVPN

Pengaturan di sisi klien OpenVPN hampir sama seperti di server OpenVPN, hanya saja dengan alamat IP yang terbalik.  Sebagai
contoh, saya membuat file `/etc/netplan/99-config.yaml` dengan isi seperti berikut ini:

```yaml
network:
  version: 2
  ethernets:
    ens4:
      dhcp4: true
    ens5:
      addresses:
       - 192.168.100.1/24
```

Bila jaringan lokal pada sisi server menggunakan IP `192.168.200.1/24`, di sisi klien, jaringan lokal-nya menggunakan IP
`192.168.100.1/24`.  Untuk menerapkan perubahan ini, saya dapat memberikan perintah:

> <strong>$</strong> <code>sudo netplan apply</code>

Saya juga akan mengaktifkan DHCP di sisi klien dengan menambahkan baris berikut ini pada `/etc/dhcp/dhcpd.conf`:

```
...
subnet 192.168.100.0 netmask 255.255.255.0 {
  range 192.168.100.10 192.168.100.20;
  option routers 192.168.100.1;
}
...
```

Sama seperti pada sisi server, saya juga mengubah file `/etc/default/isc-dhcp-server` agar mendengarkan DHCP *request* di
perangkat `ens5`:

```
INTERFACESv4="ens5"
INTERFACESv6="ens5"
```

Untuk menerapkan konfigurasi DHCP di atas, saya memberikan perintah:

><strong>$</strong> <code>sudo service isc-dhcp-server restart</code>


Seperti sebelumnya, saya menambahkan perintah berikut ini untuk mengaktifkan NAT:

><strong>$</strong> <code>sudo iptables -t nat -A POSTROUTING -o ens4 -j MASQUERADE</code>

Sebagai langkah terakhir, saya membuat konfigurasi OpenVPN dengan nama `client.ovpn` dengan isi seperti berikut ini:

```
remote 10.0.0.2
local 192.168.1.228
dev tun
ifconfig 10.1.0.1 10.1.0.2
secret static.key
route 192.168.100.0 255.255.255.0 192.168.100.1
route 192.168.200.0 255.255.255.0 10.1.0.1
```

Untuk menjalankan OpenVPN, saya memberikan perintah berikut ini:

> <strong>$</strong> <code>sudo openvpn client.ovpn</code>

```
....
Peer Connection Initiated with [AF_INET]10.0.0.2:1194
WARNING: this configuration may cache passwords in memory -- use the auth-nocache option to prevent this
Initialization Sequence Completed
```

Sampai disini, `ovpn-client` dan `ovpn-server` sudah terhubung satu sama lainnya melalui jaringan publik `router-rumah1` dan
`router-rumah2`.

---

#### Kesimpulan

Setelah melakukan konfigurasi OpenVPN dan melakukan koneksi OpenVPN antara `ovpn-client` dan `ovpn-server`, kini `PC1` dan `PC2`
 dapat menghubungi `PC3` dan `PC4` seolah-olah mereka terhubung pada jaringan yang sama.  Begitu juga sebaliknya, `PC3` dan `PC4`
juga dapat menghubungi `PC1` dan `PC2`.