---
layout: post
category: OS
title: USB Ethernet Adapter Tidak Terdeteksi Di Raspberry Pi OS
tags: [RaspberryPi]
---

Pada suatu hari, saya menggunakan sebuah papan Raspberry Pi untuk dijadikan sebagai perangkat jaringan seperti *router*,
IDS, *firewall*, *VPN gateway* dan sebagainya.  Seperti perangkat jaringan lain pada umumnya, saya membutuhkan dua
*port* RJ45 yang berbeda: satu untuk masukan yang dihubungkan ke *switch* dan satu lagi untuk keluaran yang dihubungkan 
ke Internet.  Karena Raspberry Pi hanya memiliki sebuah *port* RJ45, saya terpaksa menggunakan USB Ethernet Adapter untuk
menambahkan sebuah *port* RJ45 baru lewat USB 3.  Semua berjalan sesuai dengan harapan dan lancar hingga suatu hari 
perangkat Raspberry Pi tersebut *restart* akibat pemadaman listrik.  Sejak itu, perangkat USB Ethernet Adapter tersebut
tiba-tiba tidak terdeteksi lagi.  Bila saya memasang ulang perangkat ke port USB yang berbeda, perangkat akan kembali 
terdeteksi.  Namun saya tidak bisa selalu melakukan ini setiap kali *restart* karena saya tidak selalu berada di lokasi 
fisik yang sama.

![Raspberry Pi Dengan USB Ethernet Adapter]({{ "/assets/images/gambar_00111.png" | relative_url}}){:class="img-fluid rounded"}

Langkah pertama yang saya melakukan untuk melakukan *troubleshooting* perangkat USB adalah dengan menjalankan perintah `lsusb`.
Sebagai contoh, saya mengetikkan perintah seperti berikut ini:

> <strong>$</strong> <code>lsusb -t</code>

```
/:  Bus 02.Port 1: Dev 1, Class=root_hub, Driver=xhci_hcd/4p, 5000M
    |__ Port 1: Dev 2, If 0, Class=Mass Storage, Driver=usb-storage, 5000M
/:  Bus 01.Port 1: Dev 1, Class=root_hub, Driver=xhci_hcd/1p, 480M
    |__ Port 1: Dev 2, If 0, Class=Hub, Driver=hub/4p, 480M
```

Satu hal yang menarik perhatian saya pada hasil di atas adalah perangkat di `Bus 02.Port 1` dengan nilai `Class` berupa
`Mass Storage` dan `Driver` berupa `usb-storage`.  Bila saya menampilkan informasi khusus untuk perangkat tersebut (berdasarkan
nomor bus dan nomor perangkat), saya menemukan hasil seperti berikut ini:

> <strong>$</strong> <code>lsusb -s 2:2</code>

```
Bus 002 Device 002: ID 2357:8151 TP-Link USB 10/100/1000 LAN
```

Bila dilihat dari nilai *vendor id* `2357`, ini adalah benar produsen USB Ethernet *adapter* yang saya pakai.  Namun kenapa terdeteksi
sebagai *mass storage*?  Untuk mendapatkan informasi yang lebih detail, saya dapat menambahkan `-v` pada perintah `lsusb` seperti
berikut ini:

> <strong>$</strong> <code>lsusb -vs 2:2</code>

```
...
bInterfaceClass         8 Mass Storage
bInterfaceSubClass      6 SCSI
bInterfaceProtocol     80 Bulk-Only
...
```

SCSI merupakan *standard* yang sudah tidak populer lagi di dunia PC (*Personal Computer* atau komputer pribadi) dimana SCSI
digantikan oleh IDE yang selanjutnya diteruskan oleh SATA sebagai *interface* paling populer untuk media penyimpanan saat ini. Untuk
melihat nama perangkat penyimpan SCSI, saya bisa menggunakan perintah `lsblk` seperti berikut ini:

> <strong>$</strong> <code>lsblk --scsi</code>

```
NAME HCTL       TYPE VENDOR   MODEL       REV SERIAL TRAN
sr0  0:0:0:0    rom  Realtek  USB_CD-ROM 2.00 000001 usb
```

Hasil perintah di atas menunjukkan bahwa perangkat penyimpanan ini ada di `/dev/sr0`.  Untuk melihat isinya, saya bisa menggunakan
perintah seperti berikut ini:

> <strong>$</strong> <code>mkdir /mnt/cdrom</code>

> <strong>$</strong> <code>mount /dev/sr0 /mnt/cdrom</code>

Setelah ini, untuk mendapatkan daftar file, saya akan memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>ls /mnt/cdrom</code>

```
TP-LINK.ico  TP-LINK_Gigabit_Ethernet_USB_Adapter.exe  autorun.inf
```

Sepertinya media penyimpanan ini berisi driver untuk sistem operasi Windows yang perlu di-*install* sebelum perangkat bisa dipakai.  Tetapi
saya tidak perlu melakukan ini di Linux.  Untuk membuat perangkat ini kembali terdeteksi sebagai perangkat jaringan, 
saya dapat menggunakan perintah `usbreset` seperti berikut ini:

> <strong>$</strong> <code>usbreset 2357:8151</code>

Sekarang bila saya memberikan perintah `lsusb`, saya akan menemukan perangkat tersebut memiliki nomor produk yang berbeda dari 
sebelumnya, seperti yang terlihat pada hasil eksekusi perintah berikut ini:

> <strong>$</strong> <code>lsusb -t</code>

```
/:  Bus 02.Port 1: Dev 1, Class=root_hub, Driver=xhci_hcd/4p, 5000M
    |__ Port 1: Dev 3, If 0, Class=Vendor Specific Class, Driver=r8152, 5000M
/:  Bus 01.Port 1: Dev 1, Class=root_hub, Driver=xhci_hcd/1p, 480M
    |__ Port 1: Dev 2, If 0, Class=Hub, Driver=hub/4p, 480M
```

> <strong>$</strong> <code>lsusb -s 2:3</code>

```
Bus 002 Device 003: ID 2357:0601 TP-Link UE300 10/100/1000 LAN (ethernet mode) [Realtek RTL8153]
```

Sekarang, perangkat sudah terdeteksi sebagai perangkat *ethernet* dimana saya bisa memakainya sebagai `eth1`.  Ini adalah apa
yang saya harapkan.  Walaupun demikian, bila saya men-*restart* Raspberry Pi yang saya pakai, perangkat *ethernet* ini akan
kembali hilang dan berubah menjadi *mass storage*.  Bagaimana caranya supaya perubahan ini permanen?

Solusi yang paling cepat terpikirkan adalah dengan menjalankan `usbreset` secara otomatis melalui *script* saat Raspberry Pi
dinyalakan.  Namun, setelah melakukan penelusuran lebih lanjut, saya menemukan solusi yang lebih sederhana. Berdasarkan
informasi yang ada di <https://github.com/raspberrypi/rpi-eeprom/issues/472>, beberapa pengguna yang mengalami hal ini melaporkan
hasil yang baik bila `NET_INSTALL_ENABLED=0` ditambahkan pada file konfigurasi yang dipakai oleh *bootloader* di EEPROM.  

Untuk melakukan perubahan pada file konfigurasi EEPROM, saya dapat menggunakan perintah `rpi-eeprom-config` seperti berikut ini:

> <strong>$</strong> <code>sudo EDITOR=vim  rpi-eeprom-config --edit</code>

Setelah itu akan muncul *text editor* dimana saya akan menambahkan sebuah baris baru dengan nilai `NET_INSTALL_ENABLED=0` sehingga
isinya menjadi seperti:

```
[all]
BOOT_UART=0
WAKE_ON_GPIO=1
POWER_OFF_ON_HALT=0
NET_INSTALL_ENABLED=0
```

Setelah menyimpan perubahan file tersebut dan memberikan perintah `reboot` untuk menjalankan ulang Raspberry Pi OS, saya 
menemukan bahwa perangkat USB Ethernet Adapter yang saya pakai kini dapat terdeteksi secara otomatis sebagai perangkat jaringan, bukan 
lagi sebagai *mass storage*.