---
layout: post
category: OS
title: Memahami Proses Bootstrap Pada Sistem Operasi Android
tags: [Android]
---

Sistem operasi Android, sama seperti turunan Linux lainnya, adalah sistem operasi *open-source*.  Setiap sistem operasi juga dibuat dari kode program.  Proses
mengubah kode program menjadi hasil akhir (*artifact*) yang dapat dijalankan disebut sebagai *building*.  Bila hasil *build* program biasa dapat dijalankan 
melalui *shortcut* atau mengetikkan perintah di CLI, lalu bagaimana dengan sistem operasi? Seperti apa caranya menjalankan sistem operasi Android dari kode program?  Saya 
akan mencari jawaban pertanyaan tersebut dalam tulisan ini.

Untuk men-*build* sistem operasi Android, saya dapat mengikuti petunjuk yang ada di <https://source.android.com/setup/start>.  Cara termudah untuk mendapatkan 
kode program Android adalah dengan menggunakan tool `repo` yang direkomendasikan.  Ini adalah Python script yang sengaja dibuat untuk mempermudah pekerjaan dengan kode 
program Android.  Saya bisa mendapatkan versi terbarunya dengan mengikuti petunjuk di <https://source.android.com/setup/build/downloading>.  Setelah melakukan 
instalasi `repo`, saya memberikan perintah berikut ini untuk mendapatkan kode program Android 8.1.0_r74 (Oreo):

> $ <code>repo init -u https://android.googlesource.com/platform/manifest -b android-8.1.0_r74 --depth=1</code>

> $ <code>repo sync</code>

Saya hanya perlu menunggu hingga seluruh proses download selesai.  Ini akan memakan waktu yang cukup lama!  Apa yang sedang saya *download* secara resmi disebut sebagai
Android Open Source Project (AOSP).  Setelah mendapatkan seluruh kode program AOSP, langkah berikutnya adalah men-*build* kode program tersebut.  Biasanya 
CMake adalah *build system* yang paling umum dipakai untuk proyek C/C++ dan Maven/Gradle untuk proyek Java.  Namun, AOSP memiliki *build system* tersendiri yang
 dikembangkan khusus untuk proyek tersebut yang disebut sebagai [Soong](https://source.android.com/setup/build).  Pada dasarnya *build system* ini akan menyerahkan 
 tugasnya ke [Ninja](https://ninja-build.org).

Sebelum melakukan *building*, saya akan mengubah isi file `build/core/build_id.mk` menjadi seperti `export BUILD_ID=JOCDROID`.  Ini untuk memastikan bahwa sistem
operasi yang dijalankan nanti adalah sistem operasi yang benar.  Sekarang saatnya untuk melakukan *building*.  Sebenarnya saya bisa langsung memanggil `make` yang 
nantinya akan mendelagasikan tugasnya ke Soong.  Akan tetapi, cara yang lebih mudah adalah menggunakan script bantuan `envsetup.sh` yang dibuat untuk mempermudah 
programmer dalam bekerja dengan AOSP.  Saya bisa menggunakannya dengan memberikan perintah berikut ini:
 
> $ <code>source build/envsetup.sh</code>

> $ <code>lunch aosp_x86-userdebug</code>

Perintah `lunch` dapat dipakai untuk memilih target perangkat dan variasi sistem operasi yang hendak dibuat.  Setelah perintah ini diberikan, saya akan memiliki 
beberapa perintah siap pakai seperti `m`, `emulator`, dan sebagainya.  Jangan lupa mengerjakan kembali perintah di atas bila berpindah ke terminal baru!

<div class="alert alert-info" role="alert">
Programmer C/C++ biasanya bangga dengan <em>macro</em> seperti kemampuan berpindah ke folder utama proyek dengan cukup mengetikkan perintah <code>croot</code> 
di terminal.  Mereka biasanya bahagia dengan editor CLI seperti <code>vim</code>.  Hal ini sangat berbeda dengan programmer web yang sering memperdebatkan IDE 
favorit mereka dan mengutamakan fasilitas seperti <em>font</em> dan <em>dark mode</em>.
</div>

Saya bisa memulai *building* dengan memberikan perintah:

> $ <code>export LC_ALL=C</code>

> $ <code>m -j16</code>

Sesuaikan nilai parameter `-j` dengan jumlah core CPU untuk mendapatkan kinerja terbaik.  Tergantung pada CPU yang dipakai, proses pertama kali bisa berlangsung hingga 
satu jam lebih!  Selain itu, bisa saja berakhir dengan kegagalan jika *package* yang dibutuhkan belum ter-install di sistem operasi.  Namun, hal ini bisa diatasi cukup 
dengan memberikan perintah `sudo apt get` untuk *package* yang kurang.

Seperti apa file yang dihasilkan setelah proses *building* selesai?  Saya bisa menemukannya dengan memberikan perintah berikut ini:

> $ <code>ls out/target/product/generic_x86/*.img</code>

```
out/target/product/generic_x86/cache.img          out/target/product/generic_x86/system-qemu.img    out/target/product/generic_x86/userdata.img
out/target/product/generic_x86/encryptionkey.img  out/target/product/generic_x86/system.img         out/target/product/generic_x86/vendor-qemu.img
out/target/product/generic_x86/ramdisk.img        out/target/product/generic_x86/userdata-qemu.img  out/target/product/generic_x86/vendor.img
```

Image ini dikenal sebagai [Generic System Image (GSI)](https://developer.android.com/topic/generic-system-image).  Bagian yang paling penting dari file di atas
 adalah `system.img` yang mengandung segala sesuatu yang dibutuhkan oleh sistem operasi Android (belum termasuk *kernel*!).  Untuk menjalankannya, saya bisa memberikan
perintah berikut ini:

> $ <strong>emulator</strong> 

![Tampilan Emulator]({{ "/assets/images/gambar_00044.png" | relative_url}}){:class="img-fluid rounded"}

Akhirnya saya bisa melihat seperti apa sistem operasi Android yang paling murni tanpa tambahan dari OEM termasuk dari Google.  Yup! AOSP tidak mengandung 
Google Play Services sehingga saya tidak bisa menggunakan fitur seperti Google Play.  Dengan demikian, aplikasi seperti Gmail dan YouTube tidak akan bisa berjalan di AOSP.

<div class="alert alert-info" role="alert">
Bagaimana <code>emulator</code> bisa menjalankan <em>image</em> tanpa harus membuat AVD terlebih dahulu?  Hal ini karena macro <code>lunch</code> secara otomatis
menambahkan <code>ANDROID_PRODUCT_OUT</code> dan berbagai <em>environment variable</em> lainnya.  <code>emulator</code> akan menjalankan <em>image</em> di 
folder <code>ANDROID_PRODUCT_OUT</code> bila variabel tersebut didefinisikan.  Parameter seperti <code>-sysdir</code>, <code>-system</code>, <code>-vendor</code>,
<code>-kernel</code>, <code>-ramdisk</code>, <code>-datadir</code> dan <code>-data</code> juga dapat dipakai lebih lanjut untuk mengatur lokasi <em>image file</em>
yang hendak dipakai.
</div>

Saya bisa memastikan bahwa ini adalah sistem operasi yang saya *build* dengan memeriksa *build number*:

![Build Number]({{ "/assets/images/gambar_00045.png" | relative_url}}){:class="img-fluid rounded"}

<div class="alert alert-warning" role="alert">
Walaupun saya bisa menjalankan <em>image</em> ini di emulator, ia tidak akan bekerja di ponsel asli.  Hal ini karena setiap ponsel asli memiliki perangkat keras
berbeda.  Saya perlu mendapatkan <em>binary</em> khusus untuk ponsel yang dipakai bila tidak terdapat <em>driver</em> open-source untuk perangkat tersebut.  
Jadi, pada dasarnya, AOSP adalah sebuah sistem operasi open-source yang tidak bisa dijalankan pada perangkat asli karena membutuhkan <em>binary</em> yang tidak 
open-source!  Sebagai contoh, untuk perangkat Nexus 5X, saya bisa menemukan daftar <em>proprietary blobs</em> yang dibutuhkan di lokasi 
<code>device/lge/bullhead/proprietary-blobs.txt</code>.  Selain itu, saya juga perlu mengganti perintah <code>lunch aosp_x86-userdebug</code> dengan 
<code>lunch aosp_bullhead-userdebug</code>. 
</div>

Apa yang terjadi pada saat perangkat keras pertama kali dinyalakan?  Kode program dalam chip (SoC) akan dikerjakan.  Sebagai contoh, di chipset Qualcomm, 
kode program ini disebut sebagai Primary Bootloader (PBL).  Karena merupakan SoC, PBL tidak bisa dimodifikasi oleh OEM dan pengguna.  PBL bertugas mempersiapkan 
*hardware* seperti memori, menyalin Secondary Bootloader (SBL) atau XBL (eXtensible Bootloader) ke memori dan menyerahkan eksekusi ke wilayah memori tersebut.  Pada 
akhirnya, mereka akan menjalankan *bootloader* dari Android (ABL).

Selanjutnya, akan ada 2 kemungkinan *image* yang akan dikerjakan: sistem operasi *recovery* atau sistem operasi utama.

<div class="alert alert-info" role="alert">
Sebagai perbandingan, pada sistem operasi <em>desktop</em>, GRUB adalah <em>bootloader</em> standar yang paling popular.  GRUB dipakai oleh berbagai distro
Linux populer seperti Ubuntu.  Pengguna dapat memilih <em>menu</em> yang ditampilkan oleh GRUB untuk menentukan sistem operasi yang akan dijalankan
pada saat komputer dinyalakan.
</div>

Bila pengguna memilih untuk masuk ke *recovery mode* atau baru saja terjadi OTA update, maka  sistem operasi *recovery* akan dijalankan.  Ini adalah sebuah 
sistem operasi yang berdiri sendiri yang berjalan tanpa adanya kehadiran sistem operasi utama.  Dengan kata lain, sistem operasi *recovery* masih tetap akan bekerja 
walaupun sistem operasi utama secara tidak sengaja terhapus.

Pada kondisi normal, tentu saja sistem operasi utama yang akan dikerjakan.  Secara fisik, bagian ini terletak di `boot.img`.  File ini berisi *kernel* sistem operasi
Android. *Kernel* adalah inti dari sistem operasi Linux.  Pada emulator yang saya jalankan, *kernel* yang dipakai adalah `out/target/product/generic_x86/kernel-ranchu`.  
Ini adalah *kernel* yang hanya bisa berjalan di *emulator* saja.  
 
<div class="alert alert-info" role="alert">
Dimana letaknya kode program  <em>kernel</em> sistem operasi Android?  Ternyata bukan bagian dari kode program AOSP yang saya download!  Yang disertakan di AOSP adalah 
<em>image</em> hasil kompilasi <em>kernel</em>.  Sebagai contoh, untuk perangkat Nexus 5X, <em>image</em>-nya dapat dijumpai di <code>device/lge/bullhead-kernel/Image.gz-dtb</code>.
Bila bila saya ingin melihat kode program atau ingin megubah kode program <em>kernel</em>?  Saya bisa mendapatkan kode program <em>kernel</em> untuk perangkat keras
 target saya dengan mengikuti petunjuk di <a href="https://source.android.com/setup/build/building-kernels">https://source.android.com/setup/build/building-kernels</a>. 
</div>
 
Kenapa saya tidak menjumpai file `boot.img` pada saat melakukan *building* untuk target `aosp_x86-userdebug`?  Hal ini karena target-nya adalah emulator dimana 
 `kernel-ranchu` dipakai secara langsung oleh emulator.  Untuk melihat file `boot.img` dihasilkan sebagai output, saya bisa mencoba melakukan *building*
untuk perangkat asli, dengan memberikan perintah seperti berikut ini:

> $ <code>lunch aosp_bullhead-userdebug</code>

> $ <code>m -j16</code>

Sekarang, saya akan menemukan hasil *build* seperti berikut ini:

> $ <code>ls out/target/product/generic_x86/*.img</code>

```
out/target/product/bullhead/boot.img   out/target/product/bullhead/ramdisk-recovery.img  out/target/product/bullhead/recovery.img  out/target/product/bullhead/userdata.img
out/target/product/bullhead/cache.img  out/target/product/bullhead/ramdisk.img           out/target/product/bullhead/system.img
```

Baik file `boot.img` maupun `recovery.img` berisi *kernel* tersendiri dan bisa berjalan tanpa tergantung satu sama lainnya.  Namun, pada proses *boot* normal,
hanya file `boot.img` yang akan dipakai.

<div class="alert alert-info" role="alert">
<p>
Pada PC modern dengan UEFI (sebagai pengganti BIOS), terdapat pilihan "Secure Boot" di menu UEFI.  Bila fitur ini aktif, <em>bootloader</em> sistem operasi yang 
ter-install akan diverifikasi sebelum dikerjakan.  Saya tidak akan bisa men-install OS seperti distro Linux tertentu karena <em>bootloader</em> mereka tidak 
di-<em>sign</em> sehingga dianggap tidak aman.  Distro modern yang populer mengatasi masalah ini dengan menggunakan <em>shim booatloader</em> yang 
di-<em>sign</em> oleh Microsoft (<code>shim-signed</code> atau <code>grub-efi-amd64-signed</code>) sehingga <em>bootloader</em> mereka dianggap aman.
</p>
<p>
Android juga memiliki fasilitas serupa yang disebut dengan Verified Boot.  Istilah yang umum dipakai di Android adalah perangkat memiliki <em>bootloader</em>
terkunci (<em>locked bootloader</em>).  Tidak seperti PC dimana saya cukup masuk ke menu UEFI dan memilih konfigurasi bersangkutan, <em>'kunci' bootloader</em> 
di Android dapat dibuka tergantung pada kebijakan si pembuat perangkat.  Sebagai contoh, membuka kunci ini di perangkat buatan Google sangat mudah.  Sebaliknya, 
proses ini cukup merepotkan di perangkat Xiaomi karena saya harus men-download aplikasi tertentu dari Xiaomi yang hanya bisa dijalankan di Windows.
</p> 
</div>

Setelah *kernel* dijalankan, ia memiliki kendali penuh untuk menentukan apa yang akan dilakukan selanjutnya.  Saya bisa melihat alur eksekusi ini dengan menggunakan
fasilitas Bootchart.  Saya bisa mengaktifkannya dengan memberikan perintah seperti berikut ini:

> $ <code>emulator -bootchart 180 -no-snapshot</code>

Seharusnya argumen `-bootchart 180` akan secara otomatis menjalankan proses bootchart selama 2 menit.  Akan tetapi, saya menemukan bahwa pada emulator yang saya
pakai.  Oleh sebab itu, sebagai gantinya, saya menjalankan perintah `adb shell` setelah *emulator* dijalankan dan kemudian memberikan perintah berikut ini:

> $ <code>su</code>

> $ <code>touch /data/bootchart/enabled</code>

> $ <code>reboot</code>

Perintah di atas akan mengaktifkan proses bootchart yang melakukan pengumpulan data. Sambil menunggu sistem operasi Android dijalankan, saya bisa menjalankan perintah 
berikut ini untuk men-*download* tool yang dapat menghasilkan grafis berdasar data bootchart:

> $ <code>sudo apt install pybootchartgui</code>

Setelah halaman utama Android ditampilkan di *emulator*, saya kemudian memberikan perintah berikut ini (melalui *terminal* terpisah tanpa mematikan *emulator*):

> $ <code>$ANDROID_BUILD_TOP/system/core/init/grab-bootchart.sh</code>

Saya akan menjumpai file `bootchart.png` di lokasi dimana saya memberikan perintah di atas.  Tampilannya terlihat seperti pada gambar berikut ini:

![Hasil Bootchart]({{ "/assets/images/gambar_00046.png" | relative_url}}){:class="img-fluid rounded"}

Pada grafis di-atas, terlihat bahwa `init` adalah proses yang pertama kali dipanggil. Ia juga menunjukkan permulaan dari pengerjaan kode program *kernel*.  Ini bukanlah
sesuatu yang spesifik pada Android, melainkan sesuatu yang umum dan berlaku untuk seluruh sistem operasi Linux.  Grafis bootchart juga memperlihatkan proses apa saja yang 
dibuat oleh `init` termasuk informasi CPU dan *disk utilization* pada saat proses tersebut berjalan.  