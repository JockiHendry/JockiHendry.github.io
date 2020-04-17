---
layout: post
category: OS
title: Mengkompilasi TWRP Dari Kode Program Untuk Perangkat Yang Tidak Resmi Didukung
tags: [Android]
---

Pada [tulisan sebelumnya]({% post_url 2020-03-05-memahami-proses-bootstrap-pada-sistem-operasi-android %}), saya men-*build* AOSP dari kode program.  Fokus
utama tulisan tersebut adalah `boot.img` dan `system.img`.  Kali ini, saya akan mencoba bermain dengan *recovery image* (`recovery.img`).  Ini adalah sebuah sistem operasi kedua
yang benar-benar terpisah dari sistem operasi utama.  Untuk memasuki sistem operasi *recovery*, pengguna harus menggunakan kombinasi
tombol tertentu pada saat perangkat pertama kali dinyalakan.  Sistem operasi *recovery* bawaan biasanya menyediakan fasilitas yang sangat sederhana seperti menghapus
seluruh data pengguna atau mengatur ulang perangkat agar kembali seperti semula.

Sebagai alternatif, saya bisa meng-*install* sistem operasi *recovery* pihak ketiga seperti TWRP yang menawarkan lebih banyak fasilitas.  Pengguna yang sering melakukan 
instalasi custom ROM pasti tidak asing lagi dengan [TWRP](https://twrp.me).  Ia merupakan bagian sistem operasi [OmniROM](https://omnirom.org) (sistem operasi turunan AOSP yang dibuat oleh 
komunitas).  Walaupun TWRP awalnya dirancang untuk OmniROM, ia sudah menjadi standar untuk melakukan instalasi custom ROM lain seperti LineageOS.  Karena sistem operasi 
*recovery* terpisah dan umumnya tidak dijalankan sehari-hari, ia bisa memiliki versi Android yang berbeda dengan sistem operasi utama.  Bukan hanya itu, sistem operasi
 *recovery* juga tetap akan bekerja walaupun sistem operasi utama dihapus.     

<div class="alert alert-info" role="alert">
<p>
    Sistem operasi <em>recovery</em> bukanlah perlindungan terakhir.  Bila sistem operasi <em>recovery</em> terhapus, <em>bootloader</em> yang
    tersimpan di <em>chipset</em> tetap akan aktif sehingga perintah <code>fastboot</code> dapat dipakai untuk menulis ulang sistem operasi yang terhapus. Kombinasi
    tombol untuk memasuki <em>bootloader</em> berbeda dengan <em>recovery</em>.  Pada saat berada di <em>bootloader</em>, pengguna mengendalikan perangkat dengan 
    menggunakan <code>fastboot</code>.  Pada saat berada di sistem operasi <em>recovery</em>, penggunakan menggunakan <code>adb</code>.
</p>
<p>
    Bahkan bila <em>booloader</em> juga rusak, perangkat yang menggunakan chipset Qualcomm masih dapat mengaktifkan Emergency Download Mode (EDM) untuk
    menulis ulang <code>aboot.bin</code> sehingga <code>fastboot</code> dapat dipakai lagi.
</p>
</div>

Bila perangkat yang saya pakai sudah didukung secara resmi oleh TWRP di <https://twrp.me/Devices/>, saya hanya perlu men-*download* image *recovery* di halaman yang
tersedia.  Tetapi bagaimana bila perangkat yang saya pakai tidak didukung?  Sebagai contoh, saya akan menggunakan perangkat Xiaomi Mi 8 Lite dengan nama kode *platina*.  Perangkat 
ini belum didukung secara resmi.  Walapun tidak sulit untuk menemukan *image* tidak resmi yang beredar di berbagai website dan forum, cara yang lebih aman adalah 
dengan menghasilkan *image* sendiri berdasarkan kode program TWRP.

Apa yang saya butuhkan?
* **Kode program TWRP**: Saya tidak akan men-*build* OmniROM, jadi saya akan menggunakan <https://github.com/minimal-manifest-twrp> sebagai daftar manifest untuk `repo`.
* **Kode program kernel**:  Ini adalah bagian yang paling *open source* karena kernel Linux menggunakan lisensi GPL sehingga seluruh turunan dari kernel Linux harus 
bersifat *open source* juga.  Saya bisa menemukan kode program kernel untuk perangkat Mi 8 Lite di <https://github.com/MiCode/Xiaomi_Kernel_OpenSource/tree/nitrogen-p-oss>
(untuk Android 9).
* **Device tree**:  Ini bagian yang paling merepotkan.  Walapun saya bisa menggunakan *device tree* dari pihak ketiga, bila mereka menyertakan *binary*, saya tidak bisa
memastikan apakah *binary* tersebut berbahaya atau tidak.  Akan lebih baik bila semuanya berupa kode program atau file yang saya ekstraks sendiri dari ROM resmi. 
Oleh sebab itu, saya memutuskan untuk menyalin dari *device tree* Mi 8 (*dipper*) yang didukung resmi dan dapat ditemukan di <https://github.com/TeamWin/android_device_xiaomi_dipper>. 

<div class="alert alert-info" role="alert">
Sistem operasi Android adalah sistem operasi <em>open source</em> yang <strong>tidak terbuka</strong>.  Salah satu alasan tidak ada sebuah <em>repository</em> pusat 
dimana pengguna bisa men-<em>download</em> segala sesuatu yang dibutuhkan seperti <em>kernel</em> dan <em>proprietary binary files</em> adalah masalah legalitas.
Sebagai contoh, mendistribusikan <em>proprietary binary files</em> atau membuat software guna mendapatkan <em>proprietary binary files</em> mungkin termasuk dalam 
wilayah abu-abu (atau mungkin melanggar hukum).  Bila seluruh komponen AOSP menggunakan lisensi GPL, maka seluruh kode program untuk setiap perangkat Android harus
 <em>open source</em> juga.  Walaupun bagus bagi <em>developer</em> seperti saya, ini bisa membuat Android tidak sepopuler sekarang ini karena pembuat perangkat akan 
 memilih platform lain yang membolehkan mereka untuk tidak membagikan kekayaan intelektual mereka (dengan alasan persaingan bisnis).
</div>

Saya akan mulai dengan memberikan perintah berikut ini:

> $ <strong>repo init --depth=1 -u git://github.com/minimal-manifest-twrp/platform_manifest_twrp_omni.git -b twrp-9.0</strong>

Pada perintah di atas, saya menggunakan kode program TWRP yang berdasarkan OmniROM dan Android 9 (Pie).  Sebagai informasi, saya sebelumnya sudah melakukan 
instalasi tools `repo` dari Google di [tulisan sebelumnya]({% post_url 2020-03-05-memahami-proses-bootstrap-pada-sistem-operasi-android %}).
 
Berikutnya, saya membuat sebuah *local manifest* untuk `repo` dengan nama seperti `platina.xml` di lokasi `.repo/local_manifests` dengan isi seperti berikut ini:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest>
    <remote name="kernel" fetch="https://github.com" revision="nitrogen-p-oss" />
    <project path="kernel/xiaomi/platina" name="MiCode/Xiaomi_Kernel_OpenSource" remote="kernel" />

    <remote name="device" fetch="https://github.com" revision="android-9.0" />
    <project path="device/xiaomi/platina" name="TeamWin/android_device_xiaomi_dipper" remote="device"/>
</manifest>
```
 
Manifest di atas akan menginstruksikan `repo` untuk men-download dari GitHub yang bersangkutan ke folder `kernel/xiaomi/platina` dan `device/xiaomi/platina`.  Saya
dapat memulai proses download dengan memberikan perintah berikut ini (sembari mempersiapkan diri untuk menunggu proses download 22,7 GB selesai):

> $ <strong>. build/envsetup.sh</strong>

> $ <strong>repo sync</strong>

Langkah berikutnya adalah mengubah isi *device tree* yang ada di folder `device/xiaomi/platina`.  Saya bisa memulai dengan mencari kata `dipper` dan menggantinya
dengan `platina` dengan menggunakan perintah berikut ini:

> $ <strong>find device/xiaomi/platina -type f -exec sed -i 's/dipper/platina/g' {} +</strong>

> $ <strong>find device/xiaomi/platina -type f -exec sed -i 's/MI 8/MI 8 Lite/g' {} +</strong>

> $ <strong>find device/xiaomi/platina -name "*dipper*" -exec rename -v 's/dipper/platina/g' {}  \;</strong>


File yang paling penting di `/device/xiaomi/platina` adalah `BoardConfig.mk`.  Saya perlu melakukan beberapa pengaturan variabel di file ini.
 
Saya akan mulai dari konfigurasi *kernel*.  Karena kode program *kernel* sudah disertakan, saya bisa menghapus variabel `TARGET_PREBUILT_KERNEL` dan juga file
 `Image.gz-dtb` bawaan.  Saya merasa men-*build* sendiri kernel dari kode program lebih aman daripada memakai hasil kompilasi pihak ketiga (yang mungkin telah 
 melakukan modifikasi kode program).
 
 Selain itu, saya perlu menambahkan variabel yang dibutuhkan untuk kompilasi *kernel* seperti berikut ini:
 
```
TARGET_KERNEL_ARCH := arm64
TARGET_KERNEL_CONFIG := platina_user_defconfig
TARGET_KERNEL_CROSS_COMPILE_PREFIX := aarch64-linux-android-
TARGET_KERNEL_SOURCE := kernel/xiaomi/platina
```

Untuk mendapatkan nilai `BOARD_KERNEL_CMDLINE`, saya bisa mencontoh dari ROM resmi Mi 8 Lite yang bisa di-*download* di <https://c.mi.com/miuidownload>.  File yang 
saya butuhkan disini adalah `boot.img`.  Ini sebenarnya adalah file arsip yang terdiri atas:
* `bootimg.cfg`
* `zImage` (kernel)
* `initrd.img` (ramdisk)

Untuk meng-ekstraks `boot.img`, saya bisa menggunakan tool `abootimg` dengan memberikan perintah:

> $ <strong>abootimg -x boot.img</strong>

Sekarang, saya tinggal membuka file `bootimg.cfg` dan memeriksa nilai `cmdline` di-sini.  Saya perlu menyalin isi `cmdline` ke variabel `BOARD_KERNEL_CMDLINE` di `BoardConfig.mk`
 seperti yang terlihat pada baris berikut ini:

```
BOARD_KERNEL_CMDLINE := console=ttyMSM0,115200,n8 androidboot.console=ttyMSM0 earlycon=msm_serial_dm,0xc170000 androidboot.hardware=qcom user_debug=31 msm_rtb.filter=0x37 ehci-hcd.park=3 lpm_levels.sleep_disabled=1 sched_enable_hmp=1 sched_enable_power_aware=1 service_locator.enable=1 swiotlb=1 firmware_class.path=/vendor/firmware_mnt/image loop.max_part=7 buildvariant=user
```

Mi 8 menggunakan chipset Snapdragon 845 (CPU Kyro 385) dan GPU Adreno 630 sementara Mi 8 Lite menggunakan Snapdragon 660 (CPU Kyro 260) dan GPU Adreno 512.  Oleh sebab 
itu, saya melakukan perubahan pada parameter berikut ini:

```
TARGET_2ND_ARCH_VARIANT := armv8-a
TARGET_2ND_CPU_ABI := arm64-v8a
TARGET_2ND_CPU_VARIANT := cortex-a53
TARGET_BOOTLOADER_BOARD_NAME := sdm660
TARGET_BOARD_PLATFORM := sdm660
TARGET_BOARD_PLATFORM_GPU := qcom-adreno512
```

Sekarang, saya bisa memulai proses *building* dengan memberikan berikut ini:

> $ <strong>. build/envsetup.sh</strong>

> $ <strong>lunch omni_platina-eng</strong>

> $ <strong>export ALLOW_MISSING_DEPENDENCIES=true</strong>


> $ <strong>mka clean && mka -j12 recoveryimage</strong>


<div class="alert alert-info" role="alert">
Bila terjadi kesalahan karena ada library yang belum ter-install di sistem operasi Linux yang dipakai, gunakan <code>sudo apt-get install</code> untuk meng-<em>install</em>
libary tersebut dan jalankan ulang perintah <code>mka</code>.     
</div>

Setelah proses *building* selesai, saya dapat menguji image yang dihasilkan tanpa harus melakukan instalasi dengan menggunakan perintah `fastboot`.  Akan tetapi,
sebelumnya, saya perlu masuk dulu ke dalam modus *bootloader* di perangkat saya.  Hal ini bisa dilakukan dengan mematikan perangkat dan menahan kombinasi 
tombol *power* + *volume down* pada saat perangkat dinyalakan.  Setelah logo "fastboot" muncul, saya kemudian memberikan perintah berikut ini:

> $ <strong>fastboot boot out/target/product/platina/recovery.img</strong>

Sistem operasi TWRP yang saya *build* segera dijalankan.  Setelah memastikan tidak ada masalah, saya kemudian melakukan instalasi secara permanen ke partisi `recovery`
dengan memberikan perintah berikut ini:

> $ <strong>fastboot flash recovery out/target/product/platina/recovery.img</strong>

<div class="alert alert-info" role="alert">
Karena sistem operasi <em>recovery</em> sangat sederhana dan jarang dipakai, saya tidak memindahkan semua <em>proprietary binaries</em> dari ROM resmi ke image TWRP 
yang dihasilkan.  Hal ini akan membuat beberapa fitur yang membutuhkan <em>proprietary binaries</em> tidak bekerja seperti fitur untuk men-<em>decrypt</em> partisi yang
terkunci.
</div>

Untuk menjalankan sistem operasi *recovery* di Mi 8 Lite, saya bisa mematikan perangkat tersebut dan menahan kombinasi tombol *power* dan *volume up* pada saat perangkat
dinyalakan.