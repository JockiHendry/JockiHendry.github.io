---
layout: post
category: OS
title: Memakai QEMU untuk menjalankan Windows di Ubuntu
tags: [Ubuntu]
---

Untuk mengoptimalkan kinerja Android emulator, saya mengaktifkan KVM pada sistem operasi Ubuntu yang saya pakai. KVM adalah *hypervisor* yang terintegrasi pada kernel sistem operasi Linux.  Ini adalah teknologi yang sering dipakai oleh penyedia infrastruktur cloud seperti Google Compute Engine, Google Container Engine dan Amazon EC2.  Karena fasilitas KVM terbatas pada perangkat virtual CPU, memori dan I/O, biasanya ia dikombinasikan dengan *virtual machine* yang menyediakan emulasi perangkat grafis, penyimpanan, jaringan, dan sebagainya.  Salah satu *virtual machine* yang sering dipakai bersama dengan KVM adalah QEMU.

Berbeda dengan *virtual machine* lain seperti VirtualBox yang memiliki GUI yang indah, QEMU lebih sering dijalankan melalui CLI (perintah di *terminal*) atau secara programatis melalui libvirt (mendukung bahasa seperti C, Python, Perl, Go, dan sebagainya).  Walaupun terlihat lebih mudah bila saya memakai VirtualBox, saya akan mencoba memanfaatkan QEMU yang sudah ter-*install* dari pada harus menambah program baru (sekaligus menghindari peluang konflik dengan KVM).

Langkah pertama yang saya lakukan adalah menyiapkan sebuah *disk image* untuk men-simulasi-kan media penyimpanan yang akan dipakai oleh sistem operasi virtual nantinya.  Saya akan menggunakan format *raw* dengan memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>qemu-img create -f raw win10-disk.img 150G</code>

Perintah di atas akan membuat sebuah *disk image* baru bernama win10-disk.img dengan tipe *raw* dan ukuran 150 GB.  Walaupun ukurannya 150 GB, ukuran file *disk image* ini hanya 4 KB di sistem operasi *host* (sesuai dengan jumlah sektor yang ditulis), seperti  yang ditunjukkan oleh perintah berikut ini:

> <strong>$</strong> <code>qemu-img info win10-disk.img</code>

```
image: win10-disk.img
file format: raw
virtual size: 150 GiB (161061273600 bytes)
disk size: 4 KiB
```

Sekarang, saya bisa menjalankan QEMU dengan memberikan perintah seperti berikut ini:

> <strong>$</strong> <code>qemu-system-x86_64 -cpu host -smp cores=4 -enable-kvm -vga std -m 8G -cdrom Win10_21H1_English_x64.iso win10-disk.img</code>

Pada perintah di atas, saya menggunakan *CPU host passthrough* (`-cpu host`) sehingga prosesor yang terlihat di *host* sama persis dengan di sistem operasi *guest*.  Saya membatasinya menjadi hanya 4 core saja (`-smp cores=4`).  Tentu saja, saya tidak lupa menggunakan `-enable-kvm` agar QEMU menggunakan KVM.  Selan itu, saya juga membatasi jumlah memori ke 8 GB (`-m 8G`).

Setelah men-*download* file ISO untuk instalasi sistem operasi Windows 10, saya merujuk ke nama file tersebut dengan `-cdrom`.  Ini akan mensimulasikan sebuah perangkat DVD yang sesusai dengan isi file ISO yang diberikan.  Saya pun bisa segera memulai instalasi sistem operasi *guest*.  Saat perintah di atas dijalankan, sebuah aplikasi Gtk akan muncul berisi tampilan *virtual machine*.  Saya bisa menggunakan aplikasi ini untuk berinteraksi dengan *virtual machine* sama seperti menggunakan tampilan GUI saat memakai VirtualBox.

Setelah proses instalasi selesai dan mencoba menggunakan Windows 10 yang berjalan di dalam QEMU, saya menemukan bahwa kinerja-nya masih dibawah harapan saya.  Pergerakan mouse terkadang masih putus-putus.  Ini seharusnya bukan masalah di kemampuan perangkat keras karena saya tidak mengalaminya saat  menggunakan *virtual machine* lain seperti VirtualBox.  Oleh sebab itu, saya mencoba bereksperimen dengan menggunakan `-vga` dan `-display` lainnya.

Salah satu opsi yang populer adalah dengan mengakses *virtual machine* melalui protokol Spice dan menggunakan `-vga qxl` yang di-optimalkan untuk Spice.  Sama seperti VNC dan RDP, Spice adalah protokol yang dipakai untuk mengakses *virtual machine* secara *"jarak jauh"*.  Saya bisa mengaktifkannya dengan menjalankan QEMU dengan menggunakan perintah seperti:

> <strong>$</strong> <code>qemu-system-x86_64 \\</code>\
>    <code>-cpu host \\</code>\
>    <code>-machine vmport=off \\</code>\
>    <code>-smp cores=4 \\</code>\
>    <code>-enable-kvm \\</code>\
>    <code>-spice port=3001,disable-ticketing \\</code>\
>    <code>-vga qxl \\</code>\
>    <code>-m 4G \\</code>\
>    <code>-device virtio-serial -chardev spicevmc,id=vdagent,debug=0,name=vdagent \\</code>\
>    <code>-device virtserialport,chardev=vdagent,name=com.redhat.spice.0 \\</code>\
>    <code>win10-disk.img<code>

Pada perintah di atas, saya mengaktifkan Spice pada port 3001 (`-spice port=3001`) dan mematikan perlindungan password (`disable-ticketing`).  Hal ini karena tidak akan ada orang lain yang mengakses *virtual machine* tersebut selain saya.  Apabila ini adalah sebuah *virtual machine* yang dipakai bersama atau dapat di-akses oleh publik, orang terakhir yang terhubung akan menyebabkan koneksi pengguna sebelumnya terputus.  Untuk menghindari hal tersebut, terdapat pengaturan `password` sehingga pengguna harus memasukkan kata sandi terlebih dahulu sebelum bisa terhubung ke *virtual machine*.

Saya juga menggunakan driver qxl yang dioptimalkan untuk Spice (`-vga qxl`).  Selain itu, saya menambahkan konfigurasi `-device virtio-serial` dan `-device virtserialport` yang berguna untuk meningkatkan kinerja dan mengaktifkan fasilitas seperti *copy paste* antara sistem operasi *guest* dan sistem operasi *host*.

Sekarang, bila saya menjalankan perintah QEMU, saya tidak akan menemukan tampilan layar Gtk lagi.  Saya harus mengakses *virtual machine* dengan menggunakan sebuah Spice client seperti `virt-viewer`.  Berhubung saya menggunakan Remmina untuk mengakses Windows Server melalui Remote Desktop Protocol (RDP) dan Remmina juga mendukung protokol Spice, saya akan menggunakan Remmina untuk berinteraksi dengan *virtual machine* tersebut.

Di halaman koneksi baru Remmina, saya memilih SPICE di *Protocol* dan memasukkan nilai `localhost:3001` di *Server*.  Setelah memilih *Connect*, saya-pun terhubung ke *virtual machine* seperti yang terlihat pada gambar berikut ini:

![Menggunakan Remmina Untuk Terhubung Ke QEMU]({{ "/assets/images/gambar_00051.png" | relative_url}}){:class="img-fluid rounded"}

Agar sistem operasi *guest* berjalan dengan lebih baik lagi melalui Spice, saya perlu melakukan instalasi *guest driver* yang tersedia di <https://spice-space.org/download.html>.  Karena sistem operasi *guest* saya adalah Windows 10, saya perlu meng-install tool <https://www.spice-space.org/download/windows/spice-guest-tools/spice-guest-tools-latest.exe>.  Sebagai bonus, saya juga bisa mengakses *virtual machine* saya melalui Spice client di komputer lain atau perangkat mobile Android asalkan mereka terhubung pada jaringan yang sama.