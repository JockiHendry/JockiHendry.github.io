---
layout: post
category: Network
title: Menerapkan Network Access Control (NAC) Dengan PacketFence
tags: [Protocol]
---

Bila *firewall* melindungi dari serangan dari pihak eksternal, bagaimana dengan serangan dari dalam?  Sebagai contoh, bila ada penyusup yang masuk ke dalam gedung dan mencolokkan kabel LAN ke perangkat miliknya, ia akan mendapatkan akses internal sama seperti karyawan lain di gedung tersebut.  Kemungkinan penyusup untuk mendapatkan kata kunci untuk jaringan WiFi juga besar karena satu kata kunci yang sama dipakai secara bersama.  Bila kata kunci ini bocor, saya perlu segera menggantinya dengan nilai baru.  Namun, saya harus bersiap-siap menerima keluhan karena seluruh pengguna yang ada akan kehilangan akses WiFi dan perlu memperbaharui kata kunci di perangkat mereka.   Untuk mengatasi semua permasalah ini, saya dapat menerapkan IEEE 802.1X yang merupakan sebuah standar Network Access Control (NAC).  IEEE 802.1X dapat dipakai untuk LAN maupun WLAN.

802.1X memiliki tiga komponen utama yang terdiri atas:
1. **Supplicant** yang merupakan perangkat yang ingin menggunakan LAN atau WLAN.  Hampir semua sistem operasi modern seperti Windows 10, Ubuntu, Android dan iOS sudah mendukung 802.1X.
1. **Authenticator** yang merupakan perangkat jaringan seperti *network switch* atau *wireless access point* yang hendak dipakai.  Tidak semua *switch* untuk LAN mendukung 802.1X.  Bila ingin menggunakan 802.1X di LAN, pastikan untuk memilih *smart switch* yang mendukung 802.1X di spesifikasinya.  Begitu juga dengan *wireless access point*.  Sebagai contoh, *access point* dengan OpenWRT yang menggunakan wpad-mini, perlu melakukan instalasi wpad versi lengkap bila ingin menggunakan 802.1X di WLAN.  Fitur 802.1X di *wireless access point* diterapkan oleh WPA2-Enterprise.
1. **Authentication Server** yang merupakan *server* yang berisi daftar informasi pengguna yang di-izin-kan untuk menggunakan jaringan.  Biasanya *server* ini akan memiliki aplikasi yang mendukung protokol Remote Authentication Dial-In User Service (RADIUS).  Sebagai latihan, saya akan menggunakan [PacketFence](https://packetfence.org) yang sudah dilengkapi dengan *server* RADIUS.  PacketFence mendukung daftar pengguna dari berbagai sumber seperti Microsoft Active Directory (AD), LDAP, OAuth2, dan sebagainya.

Supplicant berkomunikasi dengan Authenticator dengan menggunakan protokol Extensible Authentication Protocol over LAN (EAPoL).  Protokol ini bekerja di L2 (*data link layer*).  Setelah itu, Authenticator akan berkomunikasi dengan Authentication Server dengan menggunakan protokol RADIUS yang berada di *application layer*.

Agar lebih jelas, saya akan mencoba mengimplementasikan 802.1X dalam lab virtual dengan menggunakan [GNS3](https://gns3.com/software).  Graphical Network Simulator-3 (GNS3) merupakan sebuah aplikasi *open-source* yang dapat di-*download* secara gratis.  Dengan GNS3, saya tidak perlu membeli *switch* baru yang mendukung 802.1X hanya untuk eksperimen sederhana.   GNS3 secara bawaan hanya menyediakan *switch* sederhana dan *virtual PC*.  Untuk menambahkan perangkat lain, seperti *switch* yang mendukung 802.1X, saya dapat mencarinya dari daftar *appliance* di <https://gns3.com/marketplace/appliances>.  Salah satu *switch* yang umum dipakai di GNS3 adalah [Cisco IOSvL2](https://gns3.com/marketplace/appliances/cisco-iosvl2).  Ini adalah IOSvL2 yang sama seperti yang dipakai di VIRL (Virtual Internet and Routing Lab) yang kini menjadi CML-Personal (Cisco Modeling Lab).  Walaupun fungsinya hampir sama seperti GNS3, CML-Personal tidak gratis.

Untuk menambahkan *appliance* IOSvL2, saya men-klik tombol **Download** untuk mendapatkan file *appliance* `cisco-iosvl2.gns3a`.  Namun, ini masih belum cukup.  Saya masih perlu men-*download* salah satu file *image* QEMU (`qcow2`) yang tertera di halaman *appliance*.  Pengguna yang sudah berlanggan CML-Personal dapat men-*download* seluruh *image* yang ada di CML-Personal seperti IOSvL2, IOSv, dan sebagainya untuk dipakai di GNS3.

<div class="alert alert-info" role="alert">
Karena IOSvL2 adalah bagian dari CML, untuk mendapatkan <em>image</em>-nya, saya harus membeli paket <a href="https://learningnetworkstore.cisco.com/cisco-modeling-labs-personal/cisco-modeling-labs-personal/CML-PERSONAL.html">Cisco Modeling Labs - Personal</a> seharga $199 per tahun.  CML-Personal memiliki fungsi yang hampir sama seperti GNS3, namun harganya lumayan mahal bagi seorang yang hanya ingin belajar dan tidak bekerja sebagai <em>network engineer</em> seperti saya.  Sebagai alternatif, saya dapat mencari <em>image</em> IOSvL2 yang dibagikan oleh pihak ketiga.  Selama hasil <em>hash</em> MD5-nya sama, <em>image</em> tersebut tetap dapat dipakai sebagai <em>appliance</em> di GNS3.
</div>

Setelah memastikan sudah memiliki file *appliance* yang dibutuhkan, saya membuka GNS3 dan memilih menu **File**, **Import appliance**, dan memilih file `cisco-iosvl2.gns3a`.  Pada langkah berikutnya, saya memilih *"Install the appliance on your local computer"* karena saya menggunakan Linux yang dilengkapi dengan QEMU sebagai Hypervisor Type 1.  Bila menggunakan sistem operasi Windows, saya perlu melakukan instalasi GNS3 VM terlebih dahulu.  Di langkah berikutnya, saya memilih lokasi instalasi QEMU.  Setelah itu, saya memilih salah satu versi IOSvL2 yang memiliki status *Ready to install* dan men-klik tombol **Next**.  Seusai men-klik tombol **Finish**, saya akan menemukan *appliance* Cisco IOSvL2 di kategori *Switches*.

<div class="alert alert-info" role="alert">
Hypervisor Type 1 dan Hypervisor Type 2 pada dasarnya adalah istilah untuk propaganda <em>marketing</em> yang tidak memiliki basis teknis yang kuat.  Pada diagram, Hypervisor Type 1 sering digambarkan berkomunikasi secara langsung dari perangkat keras ke <em>virtual machine</em> (sehingga sering disebut <em>bare-metal hypervisor</em>).  Namun, secara teknis, ini hanya bisa terjadi bila saya men-<em>flash</em> <em>firmware</em> langsung ke perangkat keras.  Produk seperti VMware ESXi pada dasarnya adalah sebuah sistem operasi mini yang dibuat khusus untuk mengelola <em>virtual machine</em>.  Di balik sistem operasi mini tersebut, cara kerja <em>virtual machine</em>-nya tidak berbeda jauh dari QEMU dan VirtualBox yang menggunakan fitur CPU seperti AMD-V dan Intel VT-x.
</div>

Pada daftar *appliance* GNS3, saya dapat menemukan *appliance* PacketFence ZEN di <https://gns3.com/marketplace/appliances/packetfence-zen>.  Namun karena versinya bukan yang terbaru, saya akan membuat *virtual machine* secara manual yang kemudian di-integrasi-kan ke GNS3.  Untuk itu, saya akan men-*download* file *image* PacketFence versi ZEN (Zero Effort NAC) yang sudah dioptimalkan untuk *virtual machine* di <https://www.packetfence.org/download.html#/zen>.  Setelah itu, saya melakukan konversi file `PacketFence-ZEN-v11.2.0.ova` menjadi file `qcow2` yang dibutuhkan QEMU dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>tar xvf PacketFence-ZEN-v11.2.0.ova</code>

> <strong>$</strong> <code>qemu-img convert -O qcow2 PacketFence-ZEN-v11.2.0-disk1.vmdk PacketFence-ZEN-v11.2.0-disk1.qcow2</code>

Setelah itu, di GNS3, saya memilih menu **Edit**, **Preferences**.  Saya kemudian memilih **QEMU**, **Qemu VMs** dan men-klik tombol **New**.  Saya kemudian mengisi nama seperti `PacketFence11` dan men-klik tombol **Next**.  Pada langkah berikutnya, saya memasukkan ukuran memori yang akan dialokasikan untuk *virtual machine* tersebut dan men-klik tombol **Next**.  Di langkah berikutnya, saya memilih **vnc** sebagai metode yang dipakai untuk mengakses *virtual machine* tersebut dan men-klik tombol **Next**.  Di langkah terakhir, saya men-klik **New Image**, **Browse**, dan kemudian memilih file `PacketFence-ZEN-v11.2.0-disk1.qcow2`.  Setelah itu, saya men-klik tombol **Finish**.  Sekarang, `PacketFence11` akan muncul sebagai salah satu *appliance* di kategori *End devices*.

Untuk mewakili komputer yang terhubung ke *switch*, saya bisa menggunakan *appliance* [Windows](https://gns3.com/marketplace/appliances/windows).  Saya akan menyebutnya sebagai `PC-HACKER` yang terhubung ke sebuah *port* untuk VLAN 44.  Sementara itu, `PC-ADMIN` adalah komputer yang dipakai oleh *administrator* untuk melakukan konfigurasi PacketFence di VLAN 1.  Hasilnya adalah sebuah rancangan jaringan seperti yang terlihat pada gambar berikut ini:

![Rancangan Jaringan Di GNS3]({{ "/assets/images/gambar_00079.png" | relative_url}}){:class="img-fluid rounded"}

Pada rancangan di atas, saya juga menghubungkan *switch* ke NAT supaya perangkat yang ada mendapatkan IP secara otomatis melalui DHCP dan juga supaya perangkat terhubung ke Internet melalui koneksi di *host*.  Dengan demikian, saya dapat men-*download* atau men-*upgrade* *browser* di *appliance* Windows.

Secara bawaan, IOSvL2 hanya memiliki VLAN 1 dimana seluruh *port* berada di VLAN ini.  Untuk menambahkan VLAN baru, saya akan men-klik kanan *switch* dan memilih menu **Start**.  Setelah itu, saya kembali men-klik kanan *switch* dan kali ini memilih menu **Console** (dapat juga dilakukan dengan men-*double click* icon *switch* di diagram).  Akan muncul sebuah **terminal** dimana saya dapat memberikan perintah IOS seperti berikut ini:

> <strong>Switch&gt;</strong><code>enable</code><br>
> <strong>Switch#</strong><code>configure terminal</code><br>
> <strong>Switch(config)#</strong><code>vlan 44</code><br>
> <strong>Switch(config-vlan)#</strong><code>exit</code><br>
> <strong>Switch(config)#</strong><code>interface range g1/0-3, g2/0-3, g3/0-3</code><br>
> <strong>Switch(config-if-range)#</strong><code>switchport access vlan 44</code><br>
> <strong>Switch(config-if-range)#</strong><code>no shut</code><br>
> <strong>Switch(config-if-range)#</strong><code>exit</code><br>
> <strong>Switch(config)#</strong><code>interface vlan 1</code><br>
> <strong>Switch(config-if)#</strong><code>ip address 192.168.122.2 255.255.255.0</code><br>
> <strong>Switch(config-if)#</strong><code>no shutdown</code><br>
> <strong>Switch(config-if)#</strong><code>exit</code><br>
> <strong>Switch(config)#</strong><code>exit</code><br>
> <strong>Switch#</strong><code>show vlan</code><br>

```
VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Gi0/0, Gi0/1, Gi0/2, Gi0/3
44   VLAN0044                         active    Gi1/0, Gi1/1, Gi1/2, Gi1/3
Gi2/0, Gi2/1, Gi2/2, Gi2/3
Gi3/0, Gi3/1, Gi3/2, Gi3/3
...
```

Sebagai langkah berikutnya, saya akan menjalankan *appliance* PacketFence.  Untuk itu, saya men-klik kanan PacketFence dan memilih menu **Console**.  Saya perlu memasukkan user default berupa `root` dengan password berupa `p@ck3tf3nc3` pada terminal Telnet yang muncul.  Untuk melihat IP yang *appliance* tersebut, saya dapat memberikan perintah berikut ini:

> <strong>$</strong> <code>ip address show dev eth0</code>

```
2: eth0: ...
   inet 192.168.122.246/24 brd 192.168.122.255 scope global dynamic eth0
   ...
```

<div class="alert alert-warning" role="alert">
Untuk percobaan jangka panjang, akan lebih baik bila menggunakan IP statis karena IP ini akan dimasukkan pada konfigurasi 802.1X di <em>switch</em> nantinya.  Untuk menggunakan IP statis, saya dapat melakukan perubahan di file <code>/etc/network/interfaces</code> dimana nilai <code>iface eth0 inet dhcp</code> diubah menjadi <code>iface eth0 inet static</code> seperti:
<p></p>
<pre>
iface eth0 inet static
  address 192.168.122.246/24
  gateway 192.168.122.1
</pre>
</div>

Untuk melakukan konfigurasi PacketFence, saya akan mengakses aplikasi web-nya dari `PC-ADMIN`.  Saya dapat membuka GUI *remote* untuk sistem operasi Windows milik `PC-ADMIN` melalui VNC dengan men-klik kanan *appliance* tersebut dan memilih **Console**.  Saat berada di dalam VNC, saya meng-*install* Google Chrome dan membuka URL https://192.168.122.246:1443 milik PacketFence.  Karena ini adalah pertama kalinya saya mengakses PacketFence, akan muncul halaman *setup* yang terdiri atas langkah-langkah berikut ini:

1. Pada langkah pertama, saya men-klik tombol **Detect Management Interface**.  Tidak ada pilihan disini karena *appliance* PacketFence saya hanya terdiri atas sebuah kartu jaringan.
1. Pada langkah kedua, bagian yang paling penting adalah memasukkan kata sandi untuk user `admin`.  Ini adalah kata sandi yang perlu saya pakai nanti saat mengakses halaman web kembali.
1. Saya tidak melakukan apa-apa pada langkah ketiga karena saya tidak ingin menggunakan Fingerbank.  Ini akan membutuhkan API key dan memanggil *endpoint* yang disediakan oleh Fingerbank untuk menampilkan informasi lebih jelas mengenai informasi perangkat yang terdeteksi.
1. Pada langkah terakhir, saya hanya perlu mengkonfirmasi kata sandi yang ada dan kemudian menekan tombol **Start PacketFence** untuk mulai memakai PacketFence.

Setelah proses konfigurasi selesai, saya akan diminta untuk login di sesuai dengan nama user dan kata sandi yang telah saya tentukan.  Saya kemudian  mendaftarkan *switch* yang saya pakai dengan memilih menu **Configuration**, **Policies and Access Control**, **Network Devices**, **Switchess** dan men-klik tombol **New Switch**, **default**.  Saya mengisi nilai *IP Address* dengan `192.168.122.2` yang merupakan IP *management* yang sebelumnya sudah saya atur di *switch* IOSvL2 (di VLAN 1).  Saya kemudian memilih **Standard Cisco Switch (Template Based)** di bagian *Type*.  Pada tab **Roles**, saya mengisi nilai *default* dengan `44` sehingga bila perangkat berhasil terhubung, mereka akan bergabung pada VLAN 44.  Pada tab **RADIUS**, saya akan memasukkan kata sandi `mysecret`.  Saya akan menggunakan kata sandi ini pada saat melakukan konfigurasi *switch* nantinya.  Setelah itu, saya men-klik tombol **Create** untuk mendaftarkan *switch* baru tersebut.   Setelah ini, saya juga dapat membuat *connection profile* baru dan melakukan konfigurasi lainnya di PacketFence.

Sekarang, saya perlu melakukan konfigurasi ulang pada *switch* IOSvL2.  Saya akan dengan masuk ke *console* untuk *switch* tersebut dan memberikan perintah seperti berikut ini:

> <strong>Switch&gt;</strong><code>enable</code><br>
> <strong>Switch#</strong><code>configure terminal</code><br>
> <strong>Switch(config)#</strong><code>dot1x system-auth-control</code><br>
> <strong>Switch(config)#</strong><code>aaa new-model</code><br>
> <strong>Switch(config)#</strong><code>radius server packetfence</code><br>
> <strong>Switch(config-radius-server)#</strong><code>address ipv4 192.168.122.246 auth-port 1812 acct-port 1813</code><br>
> <strong>Switch(config-radius-server)#</strong><code>timeout 2</code><br>
> <strong>Switch(config-radius-server)#</strong><code>key mysecret</code><br>
> <strong>Switch(config-radius-server)#</strong><code>exit</code><br>
> <strong>Switch(config)#</strong><code>aaa group server radius packetfence</code><br>
> <strong>Switch(config-sg-radius)#</strong><code>server name packetfence</code><br>
> <strong>Switch(config-sg-radius)#</strong><code>exit</code><br>
> <strong>Switch(config)#</strong><code>aaa authentication login default local</code><br>
> <strong>Switch(config)#</strong><code>aaa authentication dot1x default group packetfence</code><br>
> <strong>Switch(config)#</strong><code>aaa authorization network default group packetfence</code><br>
> <strong>Switch(config)#</strong><code>radius-server vsa send authentication</code><br>
> <strong>Switch(config)#</strong><code>snmp-server community public RO</code><br>
> <strong>Switch(config)#</strong><code>snmp-server community private RW</code><br>
> <strong>Switch(config)#</strong><code>interface range g1/0-3, g2/0-3, g3/0-3</code><br>
> <strong>Switch(config-if-range)#</strong><code>switchport mode access</code><br>
> <strong>Switch(config-if-range)#</strong><code>authentication host-mode single-host</code><br>
> <strong>Switch(config-if-range)#</strong><code>authentication order dot1x mab</code><br>
> <strong>Switch(config-if-range)#</strong><code>authentication priority dot1x mab</code><br>
> <strong>Switch(config-if-range)#</strong><code>authentication port-control auto</code><br>
> <strong>Switch(config-if-range)#</strong><code>authentication periodic</code><br>
> <strong>Switch(config-if-range)#</strong><code>authentication timer restart 10800</code><br>
> <strong>Switch(config-if-range)#</strong><code>authentication timer reauthenticate 10800</code><br>
> <strong>Switch(config-if-range)#</strong><code>mab</code><br>
> <strong>Switch(config-if-range)#</strong><code>no snmp trap link-status</code><br>
> <strong>Switch(config-if-range)#</strong><code>dot1x pae authenticator</code><br>
> <strong>Switch(config-if-range)#</strong><code>dot1x timeout quiet-period 2</code><br>
> <strong>Switch(config-if-range)#</strong><code>dot1x timeout tx-period 3</code><br>
> <strong>Switch(config-if-range)#</strong><code>exit</code><br>
> <strong>Switch(config)#</strong><code>exit</code><br>


Sekarang, `PC-HACKER` tidak akan bisa memakai jaringan walaupun terhubung secara fisik ke *switch*.  Untuk mengaktifkan 802.1X pada Windows 10, saya membuka **Services** dan men-klik kanan pada *service* *Wired AutoConfig* dan memilih menu **Start** untuk menjalankan *service* tersebut.  Sekarang, bila saya memilih perangkat jaringan di **Network Connection** dan men-klik kanan dan memilih **Properties**, saya akan menemukan tab baru dengan nama **Authentication**.  Disini saya bisa memberi tanda centang pada **Enable IEEE 802.1X authentication**.  Sekarang, setiap kali terhubung ke jaringan, Windows 10 akan menampilkan dialog seperti pada gambar berikut ini:

![Wired 802.1X Di Windows 10]({{ "/assets/images/gambar_00080.png" | relative_url}}){:class="img-fluid rounded"}

Untuk melihat paket jaringan, saya dapat men-klik kanan salah satu kartu jaringan di GNS3 dan memilih menu **Start capture**.  GNS3 secara otomatis akan menjalankan Wireshark untuk menampilkan hasil rekaman paket.  Sebagai contoh, gambar berikut ini memperlihatkan komunikasi yang terjadi setelah saya memasukkan nama user dan password di Windows 10 dan men-klik tombol **OK** saat mencoba terhubung ke jaringan:

![Komunikasi Antara Supplicant dan Authenticator]({{ "/assets/images/gambar_00081.png" | relative_url}}){:class="img-fluid rounded"}

Terlihat bahwa komunikasi dari Supplicant ke Authenticator menggunakan protokol EAPoL yang berada di *layer* dua (L2).  Sama sekali tidak ada alamat IP yang terlibat disini, karena pada tahap ini, perangkat Windows 10 belum tentu diterima oleh jaringan (misalnya bisa saja user atau password-nya salah).  Sementara itu, komunikasi dari Authenticator ke Authentication Server menggunakan UDP (dimana mereka sudah mendapat alamat IP yang pasti) seperti yang terlihat pada gambar berikut ini:

![Komunikasi Antara Authenticator dan Authentication Server]({{ "/assets/images/gambar_00082.png" | relative_url}}){:class="img-fluid rounded"}

Untuk informasi yang lebih berguna, saya dapat membuka halaman Status di *dashboard* PacketFence.  Pada tab RADIUS, saya dapat melihat informasi seperti seberapa lambat komunikasi RADIUS yang terjadi dan seberapa banyak permintaan komunikasi RADIUS seperti yang diperlihatkan pada gambar berikut ini:

![Statistik RADIUS di PacketFence]({{ "/assets/images/gambar_00083.png" | relative_url}}){:class="img-fluid rounded"}

Selain itu, pada tab *Auditing* di *dashboard* PacketFence, saya bisa mendapatkan informasi yang lebih detail mengenai setiap komunikasi RADIUS yang ada seperti yang diperlihatkan pada gambar berikut ini:

![Auditing Di PacketFence]({{ "/assets/images/gambar_00084.png" | relative_url}}){:class="img-fluid rounded"}