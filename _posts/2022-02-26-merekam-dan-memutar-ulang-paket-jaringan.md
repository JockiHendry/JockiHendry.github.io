---
layout: post
category: Network
title: Merekam dan Memutar Ulang Paket Jaringan
tags: [Protocol, Ubuntu]
---

Paket jaringan adalah unit data terkecil yang dikirim dan diterima oleh perangkat jaringan.  Karena kebanyakan aktifitas saat ini sudah berlangsung secara *online*, boleh dibilang semua aktifitas digital tercerminkan oleh paket jaringan yang keluar masuk.  Sebagai contoh, bila terjadi serangan *cyber* atau upaya pencurian data secara *remote*, informasi data apa yang bocor dan dikirim kemana dapat dijumpai di paket jaringan yang keluar masuk pada saat insiden terjadi.  Pada artikel ini, saya akan mencoba merekam paket jaringan dan memakai hasil rekaman tersebut.

### Merekam Paket Jaringan

Pada modus normal, kartu jaringan (NIC) akan memeriksa nilai MAC di paket yang masuk dan mengabaikannya bila nilai MAC tersebut tidak sesuai dengan nilai yang dimiliki kartu jaringan.  Ini bukan modus yang cocok untuk merekam paket jaringan karena saya ingin seluruh paket yang masuk di-rekam apa adanya.  Oleh sebab itu, aplikasi perekam paket biasanya mengatur kartu jaringan supaya bekerja di modus *promiscuous* yang akan menerima seluruh paket biarkan tidak ditujukan untuk kartu jaringan tersebut.

Untuk mengaktifkan modus *promiscuous* secara manual (hal ini biasanya tidak perlu dilakukan), saya dapat menggunakan perintah seperti berikut ini di Ubuntu:

> <strong>$</strong> <code>ip link show eth0</code>

```
1: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> ...
```

> <strong>$</strong> <code>ip link set dev eth0 promisc on</code>

> <strong>$</strong> <code>ip link show eth0</code>

```
1: eth0: <BROADCAST,MULTICAST,PROMISC,UP,LOWER_UP> ...
```

Untuk merekam paket tanpa menggunakan program eksternal, saya dapat menggunakan `tcpdump` bawaan Ubuntu dengan memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>sudo tcpdump -i eth0 -w capture.pcap</code>

Perintah di atas akan merekam paket jaringan yang keluar masuk di perangkat `eth0` ke dalam sebuah file dengan nama `capture.pcap` hingga program `tcpdump` tersebut ditutup (misalnya dengan Ctrl+C).  File hasil rekaman tersebut menggunakan format PCAP Capture yang dapat dipakai oleh semua aplikasi yang menggunakan `libpcap`.  Ada dua variasi format PCAP bila dilihat dari *magic number*-nya: `0xA1B2C3D4` untuk versi dengan timestamp hingga mikrodetik dan `0xA1B23C4D` untuk versi dengan timestamp hingga nanodetik.  Untuk melihat jenis format PCAP untuk sebuah file hasil rekaman, saya dapat menggunakan perintah seperti berikut ini:

> <strong>$</strong> <code>file capture.pcap</code>

```
capture.pcap: pcap capture file, microsecond ts (little-endian) - version 2.4 (Ethernet, capture length 262144)
```

Salah satu permasalahan pada perekaman paket jaringan adalah media penyimpanan yang cepat terpakai habis.  Sebagai contoh, bila saya memiliki trafik 10 MB/s secara konstan, perekaman selama 1 jam akan membutuhkan minimal 36 GB penyimpanan.  Sangat tidak realistis untuk merekam dan menyimpan seluruh paket jaringan selama bertahun-tahun.  Oleh sebab itu, untuk perekaman jangka panjang, saya dapat menggunakan tool seperti [Stenographer](https://github.com/google/stenographer).  Walaupun lebih kompleks dari `tcpdump` atau `netsniff-ng`, Stenographer akan mengelola hasil rekaman dan otomatis menghapus rekaman lama bila sudah mencapai batas penyimpanan yang sudah ditentukan.

Untuk melakukan instalasi Stenographer, saya dapat memberikan perintah berikut ini:

> <strong>$</strong> <code>sudo apt install stenographer</code>

File konfigurasi Stenographer dapat dijumpai di `/etc/stenographer/config` yang secara *default* memiliki nilai seperti berikut ini:

```json
{
  "Threads": [
    { "PacketsDirectory": "/var/lib/stenographer/thread0/packets"
    , "IndexDirectory": "/var/lib/stenographer/thread0/index"
    , "MaxDirectoryFiles": 30000
    , "DiskFreePercentage": 10
    }
  ]
, "StenotypePath": "/usr/sbin/stenotype"
, "Interface": "eth0"
, "Port": 1234
, "Host": "127.0.0.1"
, "Flags": []
, "CertPath": "/etc/stenographer/certs"
}
```

Nilai *default* untuk `DiskFreePercentage` adalah `10`.  Hal ini berarti Stenographer akan mulai menghapus rekaman lama bila media penyimpanan yang tersisa kurang dari 10%.  Pada saat menjalankan Stenographer di perangkat dengan memori terbatas, saya dapat mengurangi jumlah *blocks* yang dipakai untuk AF_PACKET. Nilai *default* `2048` akan menggunakan memori sebesar 2GB untuk menampung paket sebelum ditulis ke media penyimpanan.  Bila perangkat saya memiliki memori di bawah 2GB, Stenographer akan *crash* pada saat dijalankan.  Untuk itu, saya bisa menambahkan nilai `Flags` berikut ini pada file konfigurasi Stenographer:

```json
{
  ...
  "Flags": ["--blocks=1024"]
  ...
}
```

Untuk mengaktifkan Stenographer, saya kemudian memberikan perintah berikut ini:

> <strong>$</strong> <code>sudo chown -R stenographer:stenographer /var/lib/stenographer</code>

> <strong>$</strong> <code>sudo systemctl start stenographer</code>

Setelah perintah ini diberikan, Stenographer akan merekam paket jaringan ke lokasi `/var/lib/stenographer/thread0`.  Namun, saya tidak perlu mengambil file yang ada di folder tersebut secara langsung.  Saya dapat menggunakan `stenoread` dengan menyertakan *query* untuk melakukan *filtering* terlebih dahulu.  Sebagai contoh, untuk mengambil seluruh paket jaringan selama 24 jam terakhir dan menyimpan hasilnya dalam file `rekaman_harian.pcap`, saya dapat memberikan perintah berikut ini:

> <strong>$</strong> <code>stenoread 'after 24h ago' -w rekaman_harian.pcap</code>

Untuk mengambil paket jaringan pada rentang waktu tertentu di *timezone* WIB, saya dapat memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>stenoread 'after 2021-02-25T20:00:00+07:00 and before 2021-02-25T21:00:00+07:00' -w rekaman.pcap</code>

### Menganalisa Paket Jaringan

Bila hanya ingin mencari paket tertentu atau melihat statistik secara umum, saya tidak perlu memutar ulang hasil rekaman paket.  File hasil rekaman paket dalam format PCAP tersebut dapat dibuka secara langsung melalui aplikasi seperti [Wireshark](https://wireshark.org).   Sebagai contoh, untuk melihat protokol apa saja yang terekam, saya dapat memilih menu **Statistics**, **Protocol Hierarchy** untuk mendapatkan hasil seperti pada gambar berikut ini:

![Tampilan Protocol Hierarchy di Wireshark]({{ "/assets/images/gambar_00073.png" | relative_url}}){:class="img-fluid rounded"}

<div class="alert alert-info" role="alert">
<p>
Bila perekaman dilakukan di <em>gateway</em>, paket hasil rekaman tersebut adalah paket yang diterima oleh kartu jaringan sebelum diteruskan ke <em>firewall</em> sistem operasi di perangkat yang bersangkutan.  Oleh sebab itu, <em>gateway</em> yang terhubung ke Internet secara langsung (memiliki IP publik) akan menemukan banyak paket "aneh" seperti sebuah paket TFTP yang ingin men-<em>download</em> file a.pdf atau panggilan VoIP dari user sipvicious (dapat dilihat dengan memilih menu <strong>Telephony</strong>, <strong>VoIP Calls</strong>). Mereka biasanya berasal dari <em>scanner</em> publik atau upaya serangan di tahap <em>reconnaissance</em>.  Perangkat tetap aman bila tidak memberikan respon untuk paket tersebut, misalnya dengan diabaikan oleh <em>firewall</em> dan tidak diproses lebih lanjut oleh sistem operasi.
</p>
<p>
Ada juga paket dengan isi yang "aneh" namun sebenarnya normal.  Sebagai contoh, <code>traceroute</code> dari Linux akan mengisi data dengan nilai <code>SUPERMAN</code>.  Jadi, bila saya menjumpai paket UDP dengan isi <code>SUPERMAN</code>, ini bukanlah paket berbahaya melainkan hanya lelucon dari programmer (yang tidak terlihat saat aplikasi dijalankan).
</p>
</div>

Bila hanya ingin melihat paket untuk protokol tertentu, saya dapat men-klik kanan nama protokol tersebut di Protocol Hierarchy Statistics dan memilih menu **Apply as Filter**, **Selected**.

Untuk melihat nama domain alamat IP di hasil rekaman, saya dapat memilih menu **Statistics**, **Resolved Addresses**.  Pada tab Hosts, saya dapat memilih **Hosts** untuk hanya menampilkan nama domain yang dijumpai di dalam rekaman.  Untuk mendapatkan hasil yang lebih lengkap, saya bisa men-*resolve* IP yang ada dari komputer yang menjalankan Wireshark dengan memilih **Edit**, **Preferences...**, **Name Resolution**, dan menambahkan tanda centang pada *Resolve network (IP) addresses*.  Sekarang, bila saya membuka Resolved Addresses kembali, saya akan menemukan lebih banyak nama domain yang ditampilkan.

### Memutar Ulang Paket Jaringan

Salah satu kasus dimana paket perlu diputar ulang adalah bila ingin di-analisa oleh Intrusion Detection System (IDS) seperti Snort.  Sebagai contoh, saya akan mencoba memutar ulang paket di distro [Security Onion](https://github.com/Security-Onion-Solutions/securityonion) yang saya install dari Live ISO-nya.  Security Onion adalah sebuah distro Linux yang dilengkapi dengan berbagai tool untuk keamanan komputer seperti Surricata untuk IDS, Zeek untuk analisa *metadata* paket, Elastic *stack* untuk penyimpanan, dan sebagainya.  Penggunanya biasanya akan mengakses *dashboard* yang disebut sebagai Security Onion Console (SOC) dari browser.  Disini pengguna bisa melihat Alerts dari Surricata, membuat tiket baru di Cases (untuk *security analyst*), melihat paket mentah dan mengirimnya ke CyberChef, dan sebagainya.

Karena memutar ulang paket bisa berbahaya (karena akan mengirim kembali paket ke alamat tujuan), saya tidak akan melakukannya pada kartu jaringan yang terhubung ke Internet.  Selain itu, bisa membingungkan *router* yang tiba-tiba melihat banyak MAC baru.  Agar lebih aman, saya akan melakukan proses ini dari dalam *virtual machine* VirtualBox.  Untuk memakai Security Onion, dibutuhkan 2 kartu jaringan (NIC):

1. NIC *management* dipakai untuk mengakses web SOC dari komputer lain (termasuk dari sistem operasi *host*).  Pada konfigurasi saya, jenis jaringan VirtualBox yang dipakai untuk NIC ini adalah **Host-only Adapter**.  Saya dapat membuat jaringan *Host-only* di VirtualBox dengan memilih menu **File**, **Host Network Manager**.  Secara default, ini akan membuat jaringan di `192.168.56.0/24`.  Saya tidak mengaktifkan DHCP Server dan memilih *Configure Adapter Manually*.  Disini, saya dapat memasukkan alamat IP untuk komputer *host* seperti `192.168.56.2`.  Saat melakukan instalasi Security Onion, saya tinggal menggunakan konfigurasi IP statis untuk NIC *management*  di `192.168.56.3` sehingga *virtual machine* tersebut dapat diakses melalui `192.168.56.3` dari *host*.
1. NIC *sniffing* untuk perekaman paket jaringan.  Dengan asumsi kartu jaringan di komputer *host* sudah terhubung ke *network tap* atau *port mirroring*,  bila ingin melakukan perekaman paket dari dalam VirtualBox dengan menggunakan kartu jaringan komputer *host*, saya dapat menggunakan jenis jaringan  **Bridged Adapter** dengan nilai **Promiscuous Mode** berupa **Allow All**.

Karena ingin memutar ulang paket tanpa mengakses jaringan luar, saya perlu mengubah jenis jaringan untuk NIC yang dipakai perekaman dari **Bridged Adpater** menjadi **Internal Network** seperti yang terlihat pada gambar berikut ini:

![Konfigurasi Jaringan Internal Network Di VirtualBox]({{ "/assets/images/gambar_00074.png" | relative_url}}){:class="img-fluid rounded"}

Ini untuk memastikan bahwa paket tidak akan pernah sampai ke server publik karena **Internal Network** tidak mengizinkan akses di luar *host*.

Langkah pertama yang perlu saya lakukan adalah meng-*upload* file PCAP hasil rekaman ke Security Onion.  Walaupun saya dapat melakukannya melalui *shared folders* di VirtualBox, akan lebih ideal bila saya menganggap *virtual machine* tersebut sebagai sebuah *server* jarak jauh yang tidak perlu sering di-otak atik secara langsung.  Sama seperti *server* jarak jauh lainnya, Security Onion sudah dilengkapi dengan server SSH.  Dengan demikian, saya dapat men-*copy* file PCAP dengan perintah seperti berikut ini:

> <strong>$</strong> <code>scp rekaman_harian.pcap user@192.168.56.3:~/rekaman_harian.pcap</code>

```
##########################################
##########################################
###                                    ###
###   UNAUTHORIZED ACCESS PROHIBITED   ###
###                                    ###
##########################################
##########################################
Password: 
rekaman_harian.pcap        100% 2093MB  77.1MB/s   00:27
```

Selanjutnya, saya dapat melakukan SSH ke `192.168.56.3` dan mengerjakan `so-import-pcap` dengan memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>ssh user@192.168.56.3</code>

> <strong>[user@securityonion ~]$</strong> <code>sudo so-import-pcap rekaman_harian.pcap</code>

Setelah perintah di atas selesai dikerjakan, saya dapat membuka https://192.168.56.3 untuk melihat hasil analisa paket oleh Suricata dan Zeek seperti yang terlihat pada gambar berikut ini:

![Tampilan SOC]({{ "/assets/images/gambar_00075.png" | relative_url}}){:class="img-fluid rounded"}

Walaupun `so-import-pcap` menjalankan tugasnya dengan baik, sebenarnya ia tidak memutar ulang paket jaringan secara fisik.  Sama seperti saat saya menggunakan Wireshark untuk membaca file PCAP, `so-import-pcap` pada dasarkan akan memanggil `suricata` dan `zeek` dengan melewatkan file PCAP untuk diproses.  Bila ingin paket jaringan benar-benar diputar ulang secara fisik, saya dapat menggunakan `tcpreplay` seperti pada perintah berikut ini:

> <strong>$</strong> <code>sudo mv rekaman_harian.pcap /opt/so/samples/rekaman_harian.pcap</code>

> <strong>$</strong> <code>sudo so-tcpreplay /opt/so/samples/rekaman_harian.pcap</code>

```
Replay functionality not enabled; attempting to enable now (may require Internet access)...

Pulling so-tcpreplay image
=========================================================================
Starting tcpreplay...

This could take a while if another Salt job is running. 
Run this command with --force to stop all Salt jobs before proceeding.
=========================================================================
local:
----------
          ID: so-tcpreplay
    Function: docker_container.running
      Result: True
     Comment: Created container 'so-tcpreplay'
     Started: 09:51:37.618949
    Duration: 1707.363 ms
     Changes:   
              ----------
              container_id:
                  ----------
                  added:
                      871d58ab4cb8bf118059fd3c5913801033c1ed6b132e012e4dc80c34829ecd38
              state:
                  ----------
                  new:
                      running
                  old:
                      None

Summary for local
------------
Succeeded: 1 (changed=1)
Failed:    0
------------
Total states run:     1
Total run time:   1.707 s
Replaying PCAP(s) at 10 Mbps on interface bond0...
Actual: 2521629 packets (2154830121 bytes) sent in 1723.86 seconds
Rated: 1250000.0 Bps, 10.00 Mbps, 1462.77 pps
Flows: 14174 flows, 8.22 fps, 2507094 flow packets, 14535 non-flow
Statistics for network device: bond0
	Successful packets:        2521629
	Failed packets:            0
	Truncated packets:         0
	Retried packets (ENOBUFS): 0
	Retried packets (EAGAIN):  0
Replay completed. Warnings shown above are typically expected.
```

<div class="alert alert-warning" role="alert">
Perintah <code>so-tcpreplay</code> akan men-<em>download</em> image Docker berisi <code>tcpreplay</code> dari Docker Registry melalui Internet.  Perintah ini tidak akan bekerja bila Security Onion di-<em>install</em> pada modus <em>air gap</em> atau kartu jaringan <em>management</em> tidak memiliki akses ke Internet (misalnya tidak menggunakan <em>Bridge Mode</em> di VirtualBox).
</div>

Salah satu persyaratan untuk memakai `so-tcpreplay` adalah rekaman paket harus berada di `/opt/so/samples`. Oleh sebab itu, pada perintah di atas, saya memindahkan hasil rekaman ke folder `/opt/so/samples` terlebih dahulu.  Salah satu perbedaan utama `so-tcpreplay` dan `so-import-pcap` adalah karena `so-tcpreplay` menjalankan ulang paket secara fisik, waktu eksekusi paket di-*log* adalah waktu saat ini (saat pemutaran ulang dilakukan), bukan saat paket direkam.  Selain itu, pemutaran ulang paket secara fisik juga rentan terhadap kesalahan karena konfigurasi perangkat jaringan yang berbeda.  Sebagai contoh, ini adalah pesan kesalahan yang umum dijumpai:

```
Warning: Unable to send packet: Error with PF_PACKET send(): Message too long (errno=90)
```

Pesan kesalahan ini muncul karena paket yang direkam memiliki ukuran jauh lebih besar dari nilai Maximum Transmission Unit (MTU) yang diperbolehkan oleh kartu jaringan di VirtualBox.  Nilai MTU secara umum adalah 1500 bytes dengan nilai maksimum 64 KB untuk IPv4 dan 4 GB untuk IPv6.  Salah satu alasan kenapa paket yang direkam memiliki ukuran lebih besar dari seharusnya adalah karena fitur Large Send Offload (LSO) yang aktif saat melakukan perekaman.  Fitur LSO memungkinkan sistem operasi mengirim paket berukuran besar dalam sekali kirim dan kartu jaringan (NIC) secara otomatis akan memisahkannya menjadi segmen yang lebih kecil sebelum dikirim.  Ini akan mengurangi beban CPU (sistem operasi) karena pemisahan paket kini dilakukan oleh *chipset* di kartu jaringan.  Bila fitur ini tidak dimatikan saat merekam paket dan perekaman dilakukan langsung di *gateway* (bukan melalui *tap*), yang terekam adalah paket berukuran besar yang belum dipisahkan oleh kartu jaringan.

Seandainya saya tidak ingin merekam ulang paket, saya dapat mengubah *Adapter Type* di perangkat jaringan untuk pemutaran ulang paket di VirtualBox menjadi **Paravirtualized Network (virtio-net)**.  Setelah itu, saya memberikan perintah untuk meningkatkan nilai maksimum MTU seperti berikut ini:

> <strong>$</strong> <code>sudo ip link set eth0 mtu 65535</code>

> <strong>$</strong> <code>sudo ip link set bond0 mtu 65535</code>

Sekarang, bila saya menjalankan ulang `so-tcpreplay`, saya tidak akan menemukan pesan kesalahan lagi.