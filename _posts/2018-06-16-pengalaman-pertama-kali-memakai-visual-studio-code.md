---
layout: post
category: Pemograman
title: Pengalaman Pertama Kali Memakai Visual Studio Code
tags: [VisualStudioCode]
---

Walaupun namanya mengandung Visual Studio, Visual Studio Code (VSC) adalah sebuah produk yang berbeda dari Visual Studio.  Microsoft Visual Studio adalah sebuah *integrated development environment* (IDE) populer buatan Microsoft sejak tahun 1997 hingga sekarang.  Versi gratis dari Visual Studio adalah Visual Studio Community Edition.  Sebelum Community Edition, terdapat juga versi gratis dengan kemampuan terbatas yang disebut Visual Studio Express yang kini sudah tidak dilanjutkan lagi.  Lalu, apa itu Visual Studio Code (VSC)?

Visual Studio Code yang dirilis pada tahun 2016 boleh dibilang merupakan sebuah *source code editor* ringan dan bukan IDE yang super lengkap.  Walaupun demikian, VSC sedikit lebih canggih dibandingkan dengan *text editor* seperti Sublime dan Vim karena VSC memiliki kemampuan *debugging* dan fitur *Git* bawaan.

Seperti apa rasanya memakai VSC?

Hal pertama yang saya lakukan adalah melakukan instalasi *extension* `'IntelliJ IDEA Keybindings'`.  Sungguh terasa nyaman saat saya bisa menggunakan shortcut seperti `Alt+Panah Kanan` dan `Alt+Panah Kiri` untuk berpindah antar *tab editor*.  Selain itu, `Ctrl+Alt+Panah Kiri` masih bisa dipakai untuk kembali ke posisi kursor di lokasi pengeditan sebelumnya.  Begitu juga dengan `Ctrl+Alt+Panah Kanan` untuk memindahkan posisi kursor ke semula.  Untuk membuka sebuah file berdasarkan nama, saya tetap bisa menggunakan shortcut `Ctrl+Shift+N`.

Saat mencoba shortcut `Ctrl+N`, saya menemukan bahwa fasilitas tersebut tidak bekerja bila saya tidak membuka file sama sekali.  Setelah membuka salah satu file (apa saja), saya bisa melakukan navigasi ke file manapun cukup dengan mengetik nama *class* yang berada dalam file tersebut seperti yang terlihat pada gambar berikut ini:

![*Open symbol by name* di Visual Studio Code]({{ "/assets/images/gambar_00011.png" | relative_url}}){:class="img-fluid rounded"}

Shortcut `Ctrl+F12` untuk berpindah antar *method* atau *function* di dalam file yang sama secara cepat juga tetap bekerja. Walaupun bekerja, hasil yang ditampilkan oleh `Ctrl+F12` tidak mendukung *inheritance* (tidak menampilkan *method* milik *superclass*) seperti yang terlihat pada gambar berikut ini:

![*Go to symbol* di Visual Studio Code]({{ "/assets/images/gambar_00012.png" | relative_url}}){:class="img-fluid rounded"}

Sampai disini, *shortcut* yang sering saya pakai di IntelliJ IDEA dan Webstorm masih bekerja dengan baik.  Bukan hanya itu, sama seperti IntelliJ IDEA, VSC juga memiliki integrasi Git seperti yang terlihat pada gambar berikut ini:

![Tampilan Git di Visual Studio Code]({{ "/assets/images/gambar_00013.png" | relative_url}}){:class="img-fluid rounded"}

Walaupun demikian, saya merasakan fasilitas integrasi Git di VSC masih sangat terbatas.  Ada banyak fasilitas yang biasa saya gunakan di IntelliJ IDEA tetapi tidak disediakan oleh integrasi Git bawaan VSC.  Contoh fasilitas Git yang tersedia di IntelliJ IDEA yang sering saya pakai adalah melihat riwayat *commit*, memperbaiki pesan *commit* yang salah, melakukan perbandingan *commit* yang satu dengan *commit* lainnya, *cherrypicking* dengan satu kali klik-kanan, hingga melakukan *rebase* interaktif.  Informasi lebih lanjut mengenai fasilitas Git yang tersedia di IntelliJ IDEA bisa dilihat di <https://www.jetbrains.com/help/idea/investigate-changes.html>.

Bagi saya, fasilitas Git yang mudah dipakai akan mempengaruhi kualitas kode program programmer, terutama programmer awam.  Saat seorang programmer pemula menyelesaikan pekerjaannya, biasanya yang berada dalam pikirannya adalah rasa lega (dan mungkin juga bahagia).  Ia mungkin ingin segera beristirahat atau lanjut ke pekerjaan berikutnya.  Bila programmer tersebut belum terbiasa membaca hasil dari `git diff`, men-*review* kode program sebelum di-*commit* bisa menjadi sebuah *'tekanan batin'* tersendiri di saat sedang lega.  Ini bisa menyebabkan ia tidak *serius* men-review perubahan kode programnya.  Sebaliknya, tampilan GUI yang indah dan mudah dipahami membuat proses *review* menjadi singkat dan mudah.  Ini tentu saja akan menghilangkan kesan *'tekanan batin'* di saat-saat terakhir yang bahagia.

Selain itu, saya sering berjumpa dengan programmer awam yang tidak rela menghapus bagian tertentu dari kode programnya.  Programmer seperti itu biasanya akan mengubah kode program yang hendak dihapus menjadi baris komentar yang diawali dengan `// sementara dihapus dulu, siapa tahu suatu hari nanti akan dipakai`.  Hal ini lama-lama menyebabkan proyek penuh dengan komentar kode program yang mungkin tidak akan dipakai lagi selamanya.  Lalu mengapa programmer tidak rela menghapus?  Salah satu alasannya adalah mengembalikan baris di versi *commit* awal dengan perintah `git` tidaklah sederhana bagi yang tidak terbiasa.  Seharusnya IDE favorit dari programmer tersebut harus bisa mencari kembali baris yang dihapus secara mudah sehingga ia tidak perlu ragu-ragu menghapus kode program yang tidak dipakai lagi.  Untuk kasus seperti ini, fasilitas Git bawaan VSC (tanpa instalasi *extension* tambahan) masih sangat terbatas.

**Kesimpulan**: VSC adalah editor yang sangat lengkap dan saya akan menggunakannya untuk keperluan *editing* hal-hal sederhana seperti demontrasi, pembelajaran, dan proyek kecil.  Akan tetapi, untuk proyek yang serius dan perlu dikelola dalam jangka panjang, saya tetap akan menggunakan IDE seperti IntelliJ IDEA dan WebStorm.

Menggunakan IDE seperti IntelliJ IDEA dan WebStorm jauh lebih *berat* dibandingkan dengan VSC, apakah pantas?  Iya, tentu saja!  Sebagai contoh, belakangan ini saya melakukan migrasi Angular 5 ke Angular 6.  Salah satu perubahan yang besar adalah peralihan dari RxJs 5 ke RxJs 6.  Bila saya membuka kode program dengan VSC, semuanya tampak baik-baik saja.  Akan tetapi, saat membuka kode program yang sama di WebStorm, saya menemukan tanda garis pada pemanggilan *method* yang *deprecated*, seperti yang terlihat pada gambar berikut ini:

![Deprecated method]({{ "/assets/images/gambar_00014.png" | relative_url}}){:class="img-fluid rounded"}

Ternyata saya memakai *result selector* yang sudah *deprecated* di RxJs 6 dan rencananya akan dihapus di RxJs 7 nanti.  Sayapun segera memilih menu **Code**, **Inspect Code...** untuk memeriksa apakah ada pemanggilan *deprecated methods* lainnya.  Hal seperti ini masih belum tersedia di VSC.

Contoh fitur lain yang sering saya pakai namun tidak tersedia di *editor* seperti VSC adalah melihat struktur hierarki *inheritance*.  Mungkin saja penyebab programmer awam enggan menggunakan *inheritance* adalah sulitnya melakukan visualisasi hierarki.  Walaupun *inheritance* bisa dihindari di *business logic*, banyak framework populer seperti Spring Boot di Java sangat bergantung pada *inheritance*.  Sebagai contoh, untuk mengetahui apa saja implementasi `JsonDeserializer`, saya bisa men-klik simbol panah bawah di samping nama *class* seperti yang terlihat pada gambar di bawah ini:

![Struktur hierarki inheritance]({{ "/assets/images/gambar_00015.png" | relative_url}}){:class="img-fluid rounded"}

Saya akan menemukan hasil seperti berikut ini:

![Tampilan struktur hierarki inheritance]({{ "/assets/images/gambar_00016.png" | relative_url}}){:class="img-fluid rounded"}

Terlihat bahwa bukan hanya Spring Boot, library lain dalam proyek yang sama seperti Auth0 dan Spring Security juga menyediakan beberapa implementasi `JsonDeserializer` baru.  Tanpa cara yang mudah untuk mengetahui apa saja yang tersedia, sangat rentan bagi programmer untuk membuat kode program baru (*reinvent the wheel*), bukannya memakai yang sudah ada.
