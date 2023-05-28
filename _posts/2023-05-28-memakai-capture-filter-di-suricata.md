---
layout: post
category: Network
title: Memakai Capture Filter di Suricata
tags: [Suricata]
---

Bagaimana caranya mengabaikan beberapa alamat IP supaya tidak diproses oleh Suricata?  Salah satu solusinya adalah 
dengan melakukan perubahan pada *rule* sehingga *alert* yang dihasilkan tidak menyertakan segala sesuatu yang berhubungan 
dengan alamat IP tersebut.  Kelemahan metode ini adalah Suricata tetap perlu mem-proses *packet* dari IP bersangkutan.
Yang terkena dampak perubahannya hanya pada *output* saja dimana *alert* yang telah diproses, jika ada, akan diabaikan.
Dengan demikian, metode ini tidaklah optimal dari sisi kinerja.

Cara yang lebih direkomendasikan adalah dengan menambahkan *capture filter BPF* saat menjalankan Suricata.  Karena bekerja 
pada *input*, *packet* yang telah disaring lewat *BPF rule* tidak akan diproses lebih lanjut lagi oleh Suricata.  Dengan demikian, 
tidak akan ada kemungkinan ada *alert* atau informasi lain yang berhubungan dengan *packet* tersebut.

Untuk menambahkan *capture filter*, saya dapat menjalankan Suricata dengan perintah seperti berikut ini:

><strong>C:\&gt;</strong> <code>suricata.exe -c suricata.yaml -i 10.0.0.2 not (host 10.0.0.6 or 10.0.0.7)</code>

Pada perintah di-atas, saya menggunakan ekspresi `not (host 10.0.0.6 or 10.0.0.7)` yang akan mengabaikan seluruh *packet* yang 
berhubungan dengan IP `10.0.0.6` atau `10.0.0.7`.

Untuk mengabaikan sebuah *subnet*, seperti mengabaikan seluruh *packet* dari alamat `192.168.1.0` hingga `192.168.1.255`, 
saya dapat menggunakan ekspresi seperti berikut ini:

><strong>C:\&gt;</strong> <code>suricata.exe -c suricata.yaml -i 10.0.0.2 not net 192.168.1.0/24</code>

Selain itu, saya juga bisa mengabaikan *packet* dari MAC address tertentu (yang bekerja di L2 *data link layer*) dengan
menggunakan ekspresi seperti berikut ini:

><strong>C:\&gt;</strong> <code>suricata.exe -c suricata.yaml -i 10.0.0.2 not ether host AABBCCDDEEFF</code>

dimana nilai `AABBCCDDEEFF` adalah MAC address dari perangkat jaringan yang ingin diabaikan.
