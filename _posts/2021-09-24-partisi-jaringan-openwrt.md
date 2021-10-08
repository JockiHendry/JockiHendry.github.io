---
layout: post
category: Network
title: Pemisahan Jaringan Dengan OpenWRT
tags: [OpenWRT]
---

Setiap perangkat yang terhubung di *router* yang sama dapat berkomunikasi satu dengan yang lainnya.  Kebebasan ini akan mempermudah pengguna dalam menghubungkan berbagai perangkat IoT, media server, *smart phone*, komputer dan sebagainya.  Namun, bila dilihat dari sudut pandang keamanan komputer, tidak ada yang bisa menjamin bahwa seluruh perangkat yang terhubung adalah perangkat yang aman.  Ada saatnya saya ingin membatasi komunikasi perangkat tertentu yang terhubung di *router* yang sama.  Hal ini dapat dicapai dengan membuat *subnet* baru, melakukan partisi dengan menggunakan VLAN, dan juga konfigurasi *firewall*.

Sebagai contoh, saya akan melakukan pemisahan jaringan pada *router* rumahan saya yang menggunakan sistem operasi OpenWRT.  Saya akan mulai dengan melakukan SSH ke *router* sebagai user `root`:

> <strong>$</strong> <code>ssh root@192.168.1.1</code>

Secara garis besar, saya akan melakukan partisi untuk komunikasi sesama perangkat yang terhubung melalui WiFi, komunikasi sesama perangkat yang terhubung melalui LAN, dan komunikasi antar perangkat yang terhubung melalui WiFi dan LAN.

---
### Membatasi Komunikasi Antar Sesama Perangkat WiFi

Untuk membatasi komunikasi sesama perangkat yang terhubung melalui SSID yang sama, saya bisa menggunakan fasilitas bawaan yang disebut *AP Isolation*.  Untuk mengaktifkannya di OpenWRT, saya dapat menambahkan `option isolate 1` di konfigurasi *wifi-iface* di `/etc/config/wireless`, seperti pada:

```
config wifi-iface 'wifinet1'
        option device 'radio1'
        option mode 'ap'
        option network 'lan'
        option ssid 'Jocki1'
        ...
        option isolate '1'

config wifi-iface 'wifinet2'
	option device 'radio1'
        option mode 'ap'
        option network 'lan'
        option ssid 'Jocki2'
        ...
        option isolate '1'
```

Pada konfigurasi di atas, perangkat *router* saya menyediakan dua SSID berbeda: `Jocki1` dan `Jocki2`.  Saya menambahkan `option isolate 1` ke masing-masing SSID tersebut.  Setelah itu, saya memberikan perintah berikut ini agar perubahan file tersebut diaplikasikan:

> <strong>$</strong> <code>service network reload</code>

Sekarang, perangkat yang terhubung melalui WiFi ke SSID yang sama tidak akan bisa berkomunikasi.  Sebagai contoh, bila perangkat A terhubung ke SSID `Jocki1` dan perangkat B terhubung ke SSID `Jocki1`, maka perangkat A tidak dapat berkomunikasi dengan perangkat B.  Begitu juga dengan perangkat C yang terhubung ke SSID `Jocki2` dan perangkat D yang terhubung ke SSID `Jocki2`, perangkat C tidak akan bisa berkomunikasi dengan perangkat D.  Namun, perlu diingat bahwa AP Isolation hanya bekerja di SSID yang sama.  Perangkat A akan bisa berkomunikasi dengan perangkat C, begitu juga dengan perangkat B yang bisa berkomunikasi dengan perangkat D, karena mereka terhubung ke SSID yang berbeda!

<div class="alert alert-warning" role="alert">
<strong>PENTING:</strong> <em>AP Isolation</em> hanya bekerja di SSID yang sama.  Perangkat yang terhubung ke <em>router</em> yang sama namun SSID yang berbeda tetap bisa saling berkomunikasi!
</div>

Untuk mencegah komunikasi antar perangkat dari SSID yang berbeda, saya dapat mengatur supaya SSID `Jocki2` menggunakan sebuah *interface* baru dengan *subnet* berbeda. Sebagai contoh, saya menambahkan baris berikut ini di `/etc/config/network`:

```
config device
        option name 'br-wifi2'
        option type 'bridge'

config interface 'wifi2'
        option proto 'static'
        option netmask '255.255.255.0'
        option ipaddr '192.168.2.1'
        option device 'br-wifi2'
```

Kemudian, pada file `/etc/config/wireless`, saya mengubah nilai `network` dari `'lan'` menjadi `'wifi2'` (nama *interface* baru) untuk *wifi-iface* SSID `Jocki2`.  Selain dengan mengubah file secara langsung, saya juga bisa memodifikasi file tersebut dengan menggunakan perintah `uci` seperti:

> <strong>$</strong> <code>uci set wireless.@wifi-iface[2].network=wifi2</code>

> <strong>$</strong> <code>uci commit wireless</code>

Pada perintah di atas, saya menggunakan `@wifi-iface[2]` karena `Jocki2` adalah *wifi-iface* ketiga yang terdaftar di file konfigurasi tersebut.

Setelah itu, saya mengaktifkan DHCP untuk `wifi2` dengan menambahkan baris berikut ini di `/etc/config/dhcp`:

```
config dhcp 'wifi2'
        option interface 'wifi2'
        option start '100'
        option limit '110'
        option leasetime '1h'
        option ra 'server'
```

Untuk mengizinkan perangkat yang terhubung ke `wifi2` mengakses internet, saya menambahkan konfigurasi berikut ini di `/etc/config/firewall`:

```
config zone
        option name 'wifi2'
        list network 'wifi2'
        option input ACCEPT
        option output ACCEPT
        option forward REJECT

config forwarding
        option dest 'wan'
        option src 'wifi2'

config rule
        option name 'Allow-DHCP-wifi2'
        option src 'wifi2'
        option dest_port '67'
        option proto 'udp'
        option family 'ipv4'
        option target ACCEPT
```

Pada konfigurasi *firewall* di atas, saya membuat sebuah *zone* baru untuk *interface* `wifi2` dan melakukan *forwarding* dari `wifi2` ke `wan`.  Ini akan mengizinkan perangkat di `wifi2` untuk mengakses Internet.

Setelah me-restart *router*, kini perangkat yang terkoneksi ke SSID `Jocki1` tidak akan bisa menghubungi perangkat yang terkoneksi di SSID `Jocki2` dan begitu juga sebaliknya.

---
### Membatasi Komunikasi Antar Sesama Perangkat LAN

Biasanya *router* rumahan menyediakan satu atau lebih *port* untuk jaringan lokal (LAN).  Walaupun demikian, tidak semua *port* fisik tersebut ditangani oleh *network interface* tersendiri.  Sebagai contoh, saya hanya menemukan `eth0` pada perangkat yang saya pakai, walaupun terdapat 5 *port* fisik untuk LAN.  Lalu bagaimana cara mengakses setiap *port* fisik yang terhubung di sistem operasi bila hanya ada satu *network interface*?  *Router* tersebut menggunakan *VLAN switch* untuk melakukan segmentasi LAN secara virtual menjadi `eth0.1`, `eth0.2`, `eth0.3`, `eth0.4` dan `eth0.5`.

Konfigurasi default untuk *VLAN* adalah setiap perangkat yang terhubung di *port* LAN dapat saling berkomunikasi satu dengan yang lainnya, seperti yang terlihat pada konfigurasi di `/etc/config/network` berikut ini:

```
config switch
        option name 'switch0'
        option reset '1'
        option enable_vlan '1'

config switch_vlan
        option device 'switch0'
        option vlan '1'
        option vid '1'
        option ports '1 2 3 4 5 0t'
```

Pada nilai `ports` di atas, terlihat bahwa seluruh *port* yang tersedia memiliki status *untagged* sehingga seluruh perangkat yang terhubung di LAN dapat saling berkomunikasi.

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Salah satu perbedaan antara isolasi VLAN dan <em>subnet</em> adalah VLAN bekerja di <em>Layer 2</em> sementara <em>subnet</em> bekerja di <em>Layer 3</em>.
</div>

Untuk memisahkan sebuah perangkat yang terhubung ke LAN sehingga perangkat tersebut tidak dapat berkomunikasi dengan perangkat lainnya di LAN namun masih tetap dapat mengakses internet, saya dapat membuat sebuah VLAN baru untuk *port* yang dipakai perangkat tersebut.  Sebagai contoh, saya menambahkan konfigurasi berikut ini di `/etc/config/network`:

```
config switch_vlan
        option device 'switch0'
        option vlan '1'
        option ports '1 3 4 5 0t'  

config switch_vlan
        option device 'switch0'
        option vlan '2'
        option ports '2 0t'

config interface 'lan2'        
        option device 'eth0.2' 
        option proto 'static'
        option ipaddr '192.168.22.1' 
        option netmask '255.255.255.0'
```

Pada konfigurasi di atas, saya menghapus port `2` dari VLAN 1 dan menambahkan VLAN 2 khusus untuk port `2` tersebut.  Selain itu, saya membuat *interface* `lan2` untuk VLAN 2 dengan IP `192.168.22.1`.

<div class="alert alert-warning" role="alert">
<strong>PENTING:</strong>  Nilai angka <em>port</em> di file konfigurasi tidak selalu sama dengan posisi <em>port</em> fisik.  Sebagai contoh, pada <em>router</em> yang saya pakai, nilainya memiliki urutan yang terbalik dari <em>port</em> fisik.
</div>

Agar sederhana, saya tidak mengaktifkan DHCP untuk `lan2`.  Perangkat yang terhubung ke *port* tersebut dapat menggunakan IP statis seperti `192.168.22.2` dan menggunakan `192.168.22.1` sebagai *gateway*.  Sampai disini, perangkat ini tidak akan akan bisa berkomunikasi dengan perangkat LAN lain yang terhubung ke <em>router</em> yang sama.  Selain itu, karena menggunakan VLAN, bila saya mengatur IP statis di perangkat `lan2` menjadi nilai lain seperti `192.168.1.2` yang menggunakan *gateway* `192.168.1.1`, jaringan perangkat tersebut tidak akan bekerja.

Sebagai langkah terakhir, untuk membolehkan perangkat di `lan2` mengakses Internet, saya menambahkan baris berikut ini ke `/etc/config/firewall`:

```
config zone                                  
        option name 'lan2'                      
        list network 'lan2'                     
        option input 'REJECT'                
        option output 'ACCEPT'                  
        option forward 'REJECT'                 
                                             
config forwarding                               
        option src 'lan2'                       
        option dest 'wan'
        
config rule                           
        option name 'Allow-DNS-Lan2'
        option src 'lan2'     
        option dest_port '53'  
        option proto 'tcp udp' 
        option target 'ACCEPT'                                        
```

Setelah menjalankan ulang *router*, kini perangkat yang terkoneksi ke `lan2` akan ter-isolasi dari perangkat LAN lainnya. Perangkat tersebut juga tetap bisa mengakses internet seperti biasanya.

---
### Membatasi Komunikasi Antar Perangkat WiFi dan LAN

Sebagai bawaan dari OpenWRT, perangkat WiFi dan LAN di-*bridge* bersama.  Ini adalah konfigurasi yang disebut sebagai *Bridged AP*.  Pada konfigurasi ini, perangkat dari Wifi dan LAN dapat saling berkomunikasi.  *Bridged AP* dipilih sebagai bawaan karena sangat mempermudah komunikasi, misalnya pengguna bisa melakukan *streaming* dari *smart phone* yang terhubung di WiFi ke *media server* yang terhubung di LAN.

Bagaimana bila saya ingin memisahkan WiFi dan LAN sehingga perangkat WiFi tidak berkomunikasi dengan perangkat LAN?  Salah satu solusi untuk masalah ini adalah menerapkan membagi jaringan ke dalam VLAN seperti yang saya lakukan sebelumnya.  Pada contoh tersebut, `lan2` tidak dapat berkomunikasi dengan perangkat Wifi.  Saya hanya perlu menambahkan VLAN baru seperti `lan3`, `lan4`, dan `lan5`.

Namun, alternatif yang lebih aman adalah dengan menerapkan konfigurasi *Routed AP* yang melakukan pemisahan antara jaringan WiFi dan LAN.  Saya dapat melakukannya dnegan menambahkan sebuah *interface* baru di `/etc/config/network`:

```
config interface 'wifi'
        option proto 'static'
        option ipaddr '192.168.33.1'
        option netmask '255.255.255.0'
```

Kemudian, saya melakukan perubahan di `/etc/config/wireless` supaya *wifi-iface* menggunakan *interface* yang baru tersebut.  Selain dengan mengubah file secara manual, saya juga bisa melakukan perubahan dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>uci set wireless.@wifi-iface[1].network=wifi</code>

> <strong>$</strong> <code>uci commit</code>

Saya juga mengaktifkan DHCP untuk *interface* `wifi` dengan menambahkan baris berikut ini di `/etc/config/dhcp`:

```
config dhcp 'wifi'
        option interface 'wifi'
        option start '100'    
        option limit '10'     
        option leasetime '12h'                             
```

Sebagai langkah terakhir, saya mengatur *firewall* untuk mengizinkan perangkat Wifi mengakses internet dengan menambahkan baris berikut ini di `/etc/config/firewall`:

```
config zone
        option name 'wifi'
        list network 'wifi'
        option input 'ACCEPT'
        option output 'ACCEPT'
        option forward 'REJECT'

config forwarding
        option src 'wifi'
        option dest 'wan'
```

Setelah menjalankan ulang *router*, kali ini perangkat WiFi akan memiliki IP seperti `192.168.33.100` dan perangkat LAN tetap menggunakan IP seperti `192.168.1.2`.  Perangkat yang terkoneksi ke WiFi kini tidak dapat lagi berkomunikasi dengan perangkat yang terkoneksi ke LAN (dan sebaliknya).  Walaupun demikian, keduanya tetap memiliki akses Internet.

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Untuk mendapatkan IP terbaru melalui DHCP, bila perangkat menggunakan sistem operasi Windows, saya dapat menggunakan perintah <code>ipconfig /release</code> yang diikuti dengan <code>ipconfig /renew</code>.  Untuk perangkat Linux, saya bisa menggunakan perintah <code>dhclient -r eth0</code> yang diikuti dengan <code>dhclient eth0</code>.
</div>

---
### Membatasi Akses LuCI dan SSH

Secara bawaan, OpenWRT membolehkan perangkat WiFi untuk mengakses dashboard LuCI dan SSH ke *router*.  Karena saya hampir tidak pernah melakukan administrasi *router* dari perangkat WiFi, akan lebih aman bila saya membatasi akses sehingga hanya perangkat LAN saja yang boleh membuka LuCI atau melakukan SSH ke *router*.

Untuk itu, saya dapat dengan menambahkan baris berikut ini pada `/etc/config/firewall`:

```
config rule                                                           
        option name 'Block-Management-Wifi'                         
        option src 'wifi'                              
        list proto 'tcp'                                              
        option dest_port '80 443 22'                                
        option target 'REJECT'                         
```

Konfigurasi di atas akan menolak koneksi port `80` (http), `443` (https), dan `22` (SSH) yang berasal dari jaringan `wifi`.