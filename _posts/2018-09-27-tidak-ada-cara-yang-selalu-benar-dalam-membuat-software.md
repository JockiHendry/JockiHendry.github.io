---
layout: post
category: DevOps
title: Tidak Ada Cara Yang Selalu Benar Dalam Membuat Software?
tags: [SoftwareDevelopment]
---

Apakah benar tidak ada cara yang selalu benar dalam membuat aplikasi perangkat lunak?  Menghasilkan *software* yang bekerja bukanlah hal yang susah. Tetapi, tidak mudah untuk mencapai hasil yang *'benar'*: pengguna puas dan ingin merekomendasikannya pada orang lain, developer bahagia dan termotivasi, saham investor terus meningkat!  Mungkinkah *software* yang sukses terjadi karena faktor keberuntungan (selain karena permainan politik dan intimidasi pengguna yang tidak patut ditiru)?

Pada artikel ini, saya akan mencoba membedah pertanyaan tersebut dalam bentuk contoh kasus fiktif.

<style type="text/css">
  ul.timeline {
    list-style-type: none;
    position: relative;
  }

  ul.timeline:before {
    content: ' ';
    background: #d4d9df;
    display: inline-block;
    position: absolute;
    left: 29px;
    width: 2px;
    height: 100%;
    z-index: 400;
  }

  ul.timeline > li {
    margin: 20px 0;
    padding-left: 20px;
  }

  ul.timeline > li:before {
    content: ' ';
    background: white;
    display: inline-block;
    position: absolute;
    border-radius: 50%;
    border: 2px solid #22c0e8;
    left: 20px;
    width: 20px;
    height: 20px;
    z-index: 400;
  }
</style>

####  Metode Waterfall Yang Tidak Beruntung

{:.timeline} 
* *Hari 0*
> BO memiliki ide bisnis online yang baru dan unik.  Ini adalah hari pertamanya berdiskusi dengan seorang *product manager* berpengalaman bernama PM.  PM datang bersama dengan seorang *system analyst* bernama SA dan seorang programmer kutu buku bernama DEV.  Mereka berkumpul bersama untuk membahas tentang masa depan aplikasi web yang hendak dibuatnya.

* *Hari 5*
> PM benar-benar berpikiran kritis!  Ia memberikan banyak pertanyaan yang sebelumnya sama sekali tidak terbayang di benak BO.  Kadang BO mulai merasa gentar; segalanya tidak semudah dalam bayangannya. Tapi sudah terlambat untuk mundur: ia sudah membayar 30% biaya pengembangan dimuka.

* *Hari 10*
> DEV yang awalnya semangat mulai merasa bosan. Dia ingin *coding*!  Semua yang dibicarakan oleh PM, SA dan BO masih sangat abstrak.  Untuk apa dirinya ada disana?  "Kami membutuhkan kamu karena kami tidak mengerti *coding*," demikian selalu alasan yang diberikan oleh PM.  Selama pertemuan berlangusng, DEV selalu mendapatkan pertanyaan seperti "Untuk laporan seperti ini, butuh berapa lama?" atau "Kalau buat modul seperti ini susah ga?"  Yang bisa dilakukan oleh DEV hanya garuk-garuk kepala.  Sehebat apapun dirinya, membuat estimasi yang akurat dari sesuatu yang sangat abstrak adalah hal yang hampir tidak mungkin!

* *Hari 20*
> BO semakin risih dengan berbagai pertanyaan PM.  Ide bisnisnya masih baru, dia sendiri tidak tahu bagaimana berjalanannya nanti.  Akhirnya dia memberanikan diri untuk berkata kepada PM: "Bagaimana kalau kita buat dulu aplikasinya?  Sepertinya kita sudah menghabiskan terlalu banyak waktu berdiskusi?"  PM langsung menjelaskan kepada BO bahwa metode yang dipakainya adalah *waterfall*.  Ia memperlihatkan *gantt chart* dan alokasi *budget*.  PM akhirnya berhasil menyakinkan kepada BO bahwa 80% proses analisa ini akan terbayarkan dengan hanya waktu implementasi 20%.

* *Hari 50*
> SA yang merupakan pembaca setia <https://thesolidsnake.wordpress.com> mulai melakukan analisa dan menghasilkan artifak dari apa yang dibacanya di situs tersebut.  Sesekali ia menghubungi DEV dan PM untuk melakukan klarifikasi.  Sementara itu, DEV lebih banyak menghabiskan waktunya di kantor untuk melihat foto teman-temannya di Facebook.  Karena tidak ada pekerjaan, DEV merasa wajar bagi dirinya untuk pulang lebih awal.  
> Hal ini membuat *human resource* cemas dengan perilaku DEV dan segera menghubungi PM.  Tidak punya banyak alternatif, PM mencoba *googling* teknologi baru di forum.  Sepertinya Node.js dan MongoDB sering dibicarakan.  Keesokan harinya, ia segera berkata kepada DEV: "Lagi senggang 'kan?  Coba kamu pelajari Node.js dan MongoDB.  Nanti kita pakai di proyek kita."  Setidaknya sekarang ada *'kerjaan'* yang bisa dilakukan DEV.

* *Hari 80*
> SA sudah menyelesaikan pekerjaannya.  Dia men-*share* berbagai dokumen UML seperti Class Diagram, Sequence Diagram dan sebagainya kepada DEV untuk dikerjakan.  DEV merasa senang bisa mulai menulis kode program.  Ini adalah hari-hari yang ditunggunya.

* *Hari 90*
> Lagi-lagi DEV menghabiskan waktu tiga jam karena *typo* di nama atribut yang hendak dipanggilnya.  Tidak ada pesan kesalahan saat aplikasi dijalankan karena ini adalah Javascript: yang ada hanya sebuah variabel baru akibat *typo* dengan nilai `undefined`.  Parahnya lagi, *error* tersebut muncul hanya saat aplikasi dijalankan dan tombol tertentu di-klik.  Karena DEV tidak menulis *unit test*, ia harus mereproduksi kesalahan secara manual (termasuk membersihkan database-nya sendiri).  Untuk *troubleshooting*, DEV memeriksa keluaran dari perintah seperti `console.log()` di terminal.

* *Hari 91*
> Saat diminta untuk membantu interview programmer baru, DEV melontarkan pertanyaan berikut ini: "Mengapa memakai Node.js dan MongoDB?"  Sang pelamar-pun menjawab dengan jawaban standard: karena Node.js lebih dinamis dan lebih mudah diprogram; karena MongoDB tidak kaku dan tidak membutuhkan *schema*.  Jawaban ini langsung membuat DEV berpikir panjang atas masalah yang dihadapinya kemarin: "Saya tidak butuh yang dinamis.  Saya tidak butuh *schemaless*. SA sudah menyediakan nama class dan property-nya yang tidak akan berubah! Justru yang saya butuhkan adalah bahasa pemograman seperti Java dan C# dimana *error* dapat dideteksi sedini mungkin!"  Pencerahan ini membuatnya bahagia.  Ia langsung meng-*hire* programmer baru tersebut.

* *Hari 92*
> DEV melakukan migrasi besar-besaran dari Node.js dan MongoDB ke Java dan MariaDB.

* *Hari 95*
> BO mendatangi PM untuk mencari tahu perkembangan proyeknya.  Ia berharap ada sesuatu yang bisa dilihatnya.  Tetapi tiba dikantor, ia hanya bisa melihat DEV yang sibuk bekerja.  PM menyambutnya dengan senyum ramah dan janji bahwa proyek akan selesai sesuai dengan di-*gantt chart*.  Begitu kembali ke ruang kerjanya, BO masih ragu untuk membagikan kabar gembira bahwa proyeknya sudah rampung 80% sesuai pernyataan PM.  Apa yang bisa dilihatnya sungguh hanya tumpukan kertas dokumen dan orang-orang yang sibuk, bukankah itu sama saja dengan 0%?

* *Hari 100*
> DEV sangat bangga dengan hasil karya terbarunya.  Ia berhasil membuat sebuah aplikasi yang sangat fleksibel.  Sangat banyak hal yang bisa di-kustomisasi. Bahkan pengguna bisa mengubah semua struktur menu tanpa harus melibatkan perubahan kode program sama sekali.

* *Hari 120*
> Empat bulan sudah berlalu.  Selama menanti, BO berusaha membangun relasi dengan beberapa pemain besar di industrinya.  Ia juga menemukan bahwa ada beberapa software yang hampir mirip dengan apa yang coba dibangunnya.  Saat mencoba aplikasi-aplikasi tersebut, ia menemukan beberapa fitur yang sangat disukainya (dan juga pastinya oleh pelanggan). Tanpa tunggu panjang lebar, ia segera menghubungi PM untuk menambahkan fasilitas tersebut di proyek-nya.  Alangkah sedihnya saat ia mendengar bahwa PM tidak mau menerima perubahan.  Percakapan mereka akhirnya berubah menjadi intimidasi: BO mengancam untuk membatalkan proyek!  PM tidak punya banyak pilihan selain menyetujui.  "Lagipula, bukankah di jadwal *gantt chart*, PM sudah menambahkan *buffer* untuk berjaga-jaga?" demikian pikir BO.

* *Hari 130*
> DEV mempresentasikan hasil karyanya kepada PM.  Alangkah terkejutnya DEV saat bukannya mendapatkan pujian dari PM, malah mendapat *request*  fitur baru yang membutuhkan perubahan besar pada kode program.  Bukan hanya itu, PM tidak mau mengundur waktu rilis di *gantt chart*.  Ini berarti DEV hanya punya sekitar 1 bulan lagi untuk menyelesaikan semuanya.  Seperti biasanya, perubahan harus diserahkan kepada SA terlebih dahulu sebelum dikerjakan oleh DEV.

* *Hari 160*
> DEV yang sudah lembur tanpa henti selama sebulan akhirnya jatuh sakit dan mengalami koma.  BO mengutarakan rasa sakit hatinya kepada teman-temannya dimana ia merasa telah membayar untuk 160 hari pengembangan *software* tanpa hasil sama sekali.  PM sibuk mencari pengganti DEV.  Ia masih menyalahkan DEV yang beralih ke bahasa pemograman statis yang lebih *inferior* sehingga menyebabkan semua masalah ini.

#### Metode Waterfall Yang Beruntung

{:.timeline} 
* *Hari 0*
> BO, PM, SA dan DEV bersama-sama berdiskusi membicarakan rencana untuk migrasi sebuah aplikasi *legacy* yang sudah sangat lambat.  Aplikasi yang baru harus memiliki data yang sama seperti yang sudah ada sekarang ini.  Selain itu, BO memiliki beberapa fitur yang perlu ditambahkan pada aplikasi baru. PM menyadari migrasi ini memiliki resiko yang besar sehingga ia menawarkan untuk melakukan implementasi secara bertahap dimana aplikasi *legacy* berjalan secara bersamaan dengan aplikasi baru sampai pada akhirnya ketika seluruh fitur aplikasi baru sudah *'live'*, aplikasi *legacy*-pun dihentikan.

* *Hari 1*
> SA menawarkan rancangan *distributed system* dimana aplikasi baru memiliki *bridge* ke aplikasi lama.  Aplikasi baru ini akan terdiri atas beberapa sub-sistem.  Bila sebuah sub-sistem sudah siap, *bridge* untuk sub-sistem ini akan diarahkan ke sub-sistem tersebut sementara *bridge* lainnya tetap merujuk ke aplikasi lama.  Dengan demikian, aplikasi lama dan aplikasi baru pun bisa dijalankan secara bersamaan tanpa bentrok.  Agar perubahan di aplikasi lama bisa terlihat di aplikasi baru, SA mengusulkan rancangan yang  menggunakan *trigger* di database lama untuk memperbaharui data di database baru (dengan harapan tidak perlu mengubah kode program lama).
>
> SA tahu semua tidak sesederhana dalam bayangannnya.  Oleh sebab itu, menghabiskan banyak waktu mendalami Enterprise Integration Patterns (EIP) dan memilih *pattern* untuk dipakai setelah pertimbangan matang.

* *Hari 2*
> DEV sibuk melakukan *reverse engineering* kode program lama.  Model UML yang dihasilkannya dari kode program lama kemudian diserahkan kepada SA untuk di-analisa.  Mereka berdua juga mendiskusikan apa yang perlu dihindari dari kode program lama sehingga program baru tidak mengalami masalah yang sama.

* *Hari 30*
> Proses *reverse engineering* sudah selesai.  Artifak yang dihasilkan berupa model yang tercatat dalam bentuk buku yang tebal!  BO dan PM tidak segan mengakui bahwa mereka tidak punya banyak waktu untuk membaca seluruh halaman yang ada.  "Lebih baik kamu terangkan saja daripada kami baca sendiri," begitu alasan BO dan PM.

* *Hari 60*
> Implementasi untuk sub-sistem pertama berhasil diwujudkan oleh DEV.  Karena komunikasi antar sub-sistem menggunakan *message queue* Apache Kafka, DEV hanya perlu memastikan ia mengirim dan menerima *message* sesuai dengan format yang ditentukan oleh buku spesifikasi yang ditulis oleh SA.  Tidak sulitnya baginya untuk menulis *integration test* yang men-*mock* *message* yang diterima dan melakukan *assertion* untuk *message* dikirim kode programnya.

* *Hari 90*
> Implementasi untuk sub-sistem kedua sudah siap dan *bridge*-pun diarahkan ke sub-sistem tersebut seminggu yang lalu.  Dan hal yang paling ditakutkan terjadi: CS tiba-tiba mendapat banyak komplain dari pengguna!  PM bertindak cepat begitu mendapat email dari BO, ia segera meminta DEVOPS untuk mengarahkan *bridge* kembali ke sistem lama sembari menunggu DEV mencari tahu apa yang salah.  Beberapa hari kemudian terdengar kabar gembira dari DEV.  Ternyata masalahnya di endpoint program lama yang memiliki flag parameter dengan nama `v`.  Saat melakukan analisa bersama tim programmer lama, `v` merupakan singkatan untuk `version` di hampir semua *endpoint*.  Tapi ternyata `v` disini adalah sebuah nilai boolean untuk `verified`!

* *Hari 93*
> Setelah perbaikan, sub-sistem kedua kini berjalan dengan lancar.

* *Hari 120*
> Semua komponen sistem baru sudah berjalan di *production*.  Walaupun secara keseluruhan telat beberapa minggu dari jadwal semula, pengguna sudah merasakan dampak positif dari awal sejak sub-sistem pertama diluncurkan.  Pada awalnya hanya bagian pencarian yang terasa semakin cepat, kemudian bagian pemesanan, hingga pada akhirnya seluruh aplikasi.

#### Metode Agile Yang Kurang Beruntung

{:.timeline} 
* *Sprint 0 - Hari 0*
> BO memiliki ide bisnis online yang baru dan unik.  Ini adalah hari pertamanya berdiskusi dengan seorang *product manager* berpengalaman bernama PM.  Hari ini PM datang bersama dengan seorang *scrum master* bernama SM dan seorang programmer kutu buku bernama DEV.  Di ruangan yang sama ini, mereka bersama-sama berusaha memahami apa yang ingin dicapai oleh BO.

* *Sprint 0 - Hari 1*
> SM mulai menentukan beberapa lama *sprint*, kapan memulai dan mengakhiri *sprint*, hukuman bila telat mengikuti *daily standing*, dan berbagai artifak SCRUM yang umum.  PM pun menambahkan beberapa *story* ke backlog.  Semua dilakukan tanpa sepengetahuan DEV karena bagi SM dan PM, tidak perlu membuang waktu DEV untuk hal-hal seperti ini.  Lagipula DEV memang tidak suka ikut *meeting*.

* *Sprint 1 - Hari 0*
> DEV bingung harus memulai dari mana saat ia mengerjakan *story* dari PM.  Isi *story* hanya kalimat singkat berupa "Sebagai pengguna, saya ingin bisa login."  Ada banyak pertanyaan yang muncul di pikiran DEV: "Apakah saya harus menggunakan database, Auth0 atau Firebase Authentication?  Seperti apa tampilannya?  Apakah butuh fasilitas *remember-me*?"  Ia pergi ke ruangan PM untuk bertanya tapi ternyata PM sedang tidak ada di kantor.

* *Sprint 1 - Hari 1*
> Tidak ingin disalahkan, DEV menunggu jawaban dari PM sebelum mulai bekerja.  Karena belum ada jawaban, hari ini adalah hari yang santai baginya.  DEV bukanlah karyawan yang malas, sebagai gantinya, dia membuat beberapa fitur yang  menurutnya mungkin dibutuhkan.  Ia juga menulis kode program yang membuat aplikasinya fleksibel.  Satu hal yang tidak pernah dilakukannya adalah menulis *unit test* dan *integration test*.  DEV selalu merasa tidak ada waktu untuk menulis pengujian otomatis yang bisa dilakukan secara manual.

* *Sprint 1 - Hari 2*
> PM sudah membalas jawaban DEV.  Mengutip kata-kata dari SM bahwa teknologi yang dipakai sepenuhnya wewenang DEV.  "Selain itu, pada Scrum, developer membuat versi paling sederhana dari sebuah program dan memolesnya berulang kali hingga sempurna," begitu pandangan SM yang dibagikan kepada DEV.  Tapi DEV berpikir lain: "Kalau aku bisa membuat lebih baik, mengapa harus buat yang sederhana?"  Ia pun menghabiskan banyak waktunya membuat sebuah halaman login yang sempurna.

* *Sprint 1 - Review*
> DEV hanya berhasil menyelesaikan satu *story* dari lima *story* yang dijadwalkan.  Walaupun demikian, DEV dalam hati bangga karena ia berhasil menulis sesuatu yang kompleks.  Bukan hanya itu, ia juga membuat banyak fitur lain yang tidak di-*'minta'*.  "Beberapa dari fitur ini hampir jadi," pikir DEV, "Yang kurang hanya tampilan UI-nya.  Beberapa *sprint* lagi mereka pasti bisa melihatnya."
>
> PM sedikit kecewa namun ia tidak mempermasalahkannya. "Ini baru permulaan dimana akan ada banyak proses pembelajaran menuju ke arah yang lebih baik," pikirnya.
>
> Hari ini BO juga ikut serta dalam SCRUM Review.  PM tidak hentinya menyakinkan BO bahwa website yang dilihat oleh dirinya adalah website *'live'* yang bisa dipakai oleh pengguna asli. Bila BO ingin berhenti dari pengembangan *agile* sampai pada *sprint* ini, maka website tersebut dapat langsung dipakainya. BO terlihat cukup bahagia walaupun yang dilihatnya hanya halaman login.  Soalnya, ia pernah terlibat pada proses pengembangan *waterfall* dimana ia sudah menunggu 160 hari tanpa ada sesuatu yang benar-benar bisa dipergunakan.

* *Sprint 2 - Planning*
> Setiap kali DEV memberikan estimasi untuk sebuah *story*, PM selalu menawar dengan meningkatkannya menjadi dua kali lipat.  "Kamu 'kan hebat, aku yakin kamu bisa lebih dari hanya 5 *story*," demikin rayuan PM.  Ia juga tidak henti-hentinya mengeluarkan kutipan Steve Job, Jack Ma, Bill Gates hingga anonim untuk memotivasi DEV.  Proses perencanaan menjadi seperti pasar dimana masing-masing saling tawar menawar.

* *Sprint 2 - Hari 3*
> DEV adalah seorang yang perfeksionis. Ia sangat memperhatikan detail.  Sebagai contoh, hari ini ia mengerjakan sebuah modul untuk menampilkan data dalam bentuk diagram garis.  Karena nilai yang ditampilkan ada yang sangat besar dan ada yang sangat kecil, DEV menghabiskan waktu untuk menambahkan rumus logaritma agar grafis memiliki skala yang tepat dan terlihat indah.

* *Sprint 2 - Hari 5*
> DEV sudah menyelesaikan sebuah *story* baru.  PM terlihat senggang.  Akan tetapi, DEV takut PM meminta perubahan sehingga ia segera melanjutkan ke *story* berikutnya tanpa memberi tahu PM.  "Bukankah semuanya juga akan di-demo-kan lagi selama Sprint Review?" demikian pikir DEV.

* *Sprint 2 - Review*
> Setelah BO memperhatikan demo aplikasi, tiba-tiba otak kreatifnya bekerja!  Screen XYZ yang ada di *backlog* sebenarnya bisa digabungkan dengan screen yang sudah ada sekarang.  Ini tentu saja akan membuat aplikasinya lebih mudah dipergunakan!  Ia langsung mengutarakan niatnya.
>
> Mendengar pernyataan BO tersebut, DEV langsung tidak senang!  Sesungguhnya ia sudah menulis kode program *back end* untuk screen XYZ, hanya saja belum ada screen-nya.  Bila ia menggabungkan ke screen saat ini, maka kode program *'tak terlihat'*-nya perlu dihapus.  Akan tetapi pernyataan BO adalah sesuatu yang masuk akal, PM saja sudah setuju, bagaimana DEV bisa menolak?

* *Sprint 3 - Hari 3*
> DEV dengan berat hati harus menghapus kode program *back end* yang sudah dikerjakannya.

* *Sprint 3 - Review*
> BO tiba-tiba berkata: "Saya rasa diagram garis ini terlalu mencolok.  Mungkin kita ganti dengan sebuah diagram *pie* saja.  Lalu bagian yang kosong kita isi dengan pesan notifikasi terbaru karena sekarang fitur notifikasi sudah aktif."
> Mendengar ini, DEV langsung sedih.  Kali ini ia harus menghapus rumus logaritma yang ditemukannya seharian.

* *Sprint 4 - Hari 2*
> DEV menghabiskan waktunya seharian di akun LinkedIn-nya mencari lowongan pekerjaan baru.  Ia merasa dirinya tidak lagi dihargai oleh timnya.  Semua hasil jerih payahnya selalu harus diubah dan dihapus.

* *Sprint 4 - Hari 3*
> SM merasa semuanya baik-baik saja.  "Perkembangan memang lambat tapi *steady* (stabil)," demikian pikir SM.  Ia menilai semua ini berdasarkan angka statistik seperti *velocity*. *burn down chart*, dan sebagainya.  SM jarang sekali bertemu dengan PM dan DEV untuk berkomunikasi secara tatap muka.

* *Sprint 4 - Review*
> Sesuatu yang buruk terjadi hari ini!  DEV lupa melakukan migrasi database cara manual di server *staging*.  Parahnya lagi, DEV tidak sadar bahwa itu adalah penyebab mengapa server *staging* tidak bekerja.  Maklum saja, DEV tidak memiliki *deployment pipeline* karena tidak ada DEVOPS disini.  Padahal semuanya berjalan dengan normal dilaptopnya.  Setelah hampir setengah jam otak-atik tidak jelas di ruang *meeting*, akhirnya DEV menggunakan laptop pribadinya sebagai alat presentasi.

* *Sprint 6 - Planning*
> Pada Sprint Planning kali ini, tidak ada lagi DEV.  Programmer hebat itu sudah *resign*!  Beruntungnya, PM sudah mendapat kucuran dana investasi sehingga dia bisa me-rekruit 20 developer senior sebagai pengganti DEV.  Sayangnya, bukannya pengembangan menjadi semakin cepat, tetapi malah terasa tidak ada perkembangan.  Setiap *planning* selalu diawali dengan perdebatan tanpa henti.  *Planning* yang dulunya memakan waktu 3 jam (sebelum *lunch* sudah selesai) sekarang sudah bisa seharian (dilanjutkan lagi setelah *lunch*).

* *Sprint 666 - Review*
> Sampai sejauh ini, aplikasi masih belum bisa memenuhi kebutuhan bisnis yang standar dan layak pakai (penuh dengan bug!).  BO pun mengalami frustasi berat hingga perlu dirawat di rumah sakit.

#### Metode Agile Yang Beruntung

{:.timeline} 
* *Sprint 0 - Hari 0*
> BO memiliki ide bisnis online yang baru dan unik.  Ini adalah hari pertamanya berdiskusi dengan seorang *product manager* berpengalaman bernama PM.  Hari ini PM datang bersama dengan seorang *scrum master* bernama SM dan seorang programmer kutu buku bernama DEV.  Di ruangan yang sama ini, mereka bersama-sama berusaha memahami apa yang ingin dicapai oleh BO.

* *Sprint 1 - Planning*
> SM mulai menentukan beberapa lama *sprint*, kapan memulai dan mengakhiri *sprint*, hukuman bila telat mengikuti *daily standing*, dan berbagai artifak SCRUM yang umum.  PM pun menambahkan beberapa *story* ke backlog sesuai dengan prioritis yang ditentukan oleh BO.  Semua dilakukan bersama dengan DEV.  PM merasa penting bagi DEV untuk mengetahui prioritas dari kebutuhan bisnis aplikasi yang akan ditulisnya.

* *Sprint 1 - Hari 1*
> DEV mengerjakan sebuah *story* dengan kalimat singkat "Sebagai pengguna, saya ingin bisa login."  Ia tidak mengerjakannya sendiri melainkan duduk bersama dengan DES dan PM.  DES menggunakan aplikasi Sketch di MacBook-nya untuk membuat *mockup* dari halaman yang perlu diimplementasikan DEV.  Perubahan di *mockup* jauh lebih gampang dibandingkan dengan di kode program.  Setelah PM puas dengan hasil di *mockup*, DEV pun mengimplementasikannya.

* *Sprint 1 - Hari 2*
> Saat membuat kode program, DEV tidak menulis lebih dari yang dibutuhkan.  Ia sadar bahwa pada pengembangan *agile*, kode program akan berevolusi secara cepat.  Itu sebabnya ia banyak menggunakan abstraksi seperti *interface* yang disediakan oleh Spring Security dan *design pattern* seperti *adapter*.  Selain itu, ia memastikan bahwa kode programnya sudah sesuai dengan *best practise* di industri.  Misalnya, DEV selalu menulis *unit test*.
>
> DEVOPS berhasil mengatur Jenkins agar men-*deploy* ke server *staging* begitu ada kode program di-*commit* ke *branch* `master` di GitHub.  DEVOPS memilih untuk men-*deploy* berdasarkan hanya satu *branch* tunggal yaitu `master`.  Ini adalah cara yang paling sederhana dan efektif.  Ia merasa tidak banyak manfaatnya memiliki branch `dev` atau `prod` terpisah.  "Hanya kepuasan teknis tanpa banyak nilai bisnis malah memperumit suasana," demikian pikir DEVOPS.

* *Sprint 1 - Hari 3*
> Sebuah fitur dianggap lengkap bila *front end* dan *back end* sudah jadi.  Oleh sebab itu, SM sangat merekomendasikan supaya masing-masing *developer* bisa menulis kode program *front end* dan *back end*.  Ia selalu menyarankan kepada PM untuk menambahkan syarat memiliki *T-shaped skills* saat mencari developer baru.
>
> Hari ini, fitur login sudah jadi.  DEV menutup *story* yang dikerjakannya di *tracker*.  PM yang mendapat notifikasi segera memeriksa hasilnya di server *staging*.  Ia menemukan bahwa password yang di-validasi ternyata tidak *case sensitive*.  Ia segera membuka *story* tersebut di *tracker* dan menuliskan alasannya.  DEV dengan sigap memperbaikinya pada hari itu juga.

* *Sprint 1 - Hari 4*
> *Story* berikutnya yang dikerjakan adalah: "Sebagai pengguna, setelah login saya ingin melihat dashboard yang dilengkapi menu navigasi."  SM pernah menjelaskan bahwa pengembangan software secara SCRUM mirip seperti evolusi makhluk hidup: mulai dari organisme sederhana yang terus berubah hingga menjadi kompleks.  Analogi evolusi ini membuat *agile* sangat berbeda dari analogi perakitan mobil: membuat komponen-komponen terpisah secara bersamaan dan merakitnya menjadi satu di kemudian hari.
>
> "Saya ingin ada icon notifikasi yang memiliki angka merah di bagian bawah bila ada notifikasi baru," kata PM saat sedang melihat rancangan di Sketch.  "Ok, apakah seperti ini?" jawab DES sambil mengerakkan mouse wireless-nya.
>
> "Tapi implementasinya akan ada di story lain.  Ini adalah bagian dari fitur notifikasi yang belum bisa kita mulai sekarang.  Walaupun seandainya bisa, fitur ini juga bukan prioritas utama," DEV segera mengingatkan.
>
> "Tidak masalah.  Saya akan membuat *story* baru sebagai pengingat dan menambahkannya ke *backlog*," jawab PM dengan tenang.

* *Sprint 1 - Review*
> DEV hanya berhasil menyelesaikan seluruh *story* yang dijadwalkan.  PM dan BO sangat puas dengan hasilnya.

* *Sprint 2 - Planning*
> Bersama dengan seluruh anggota tim, DEV memberikan nilai estimasi ke setiap *story* di backlog.  Agar tetap sederhana, DEV membatasi pilihan
nilai estimasi ke 1, 2, dan 3.
>
> "Mengapa hanya tiga angka saja?" PM mulai menyadarinya, "Mengapa tidak membuat lebih granular sehingga saya bisa menggunakan estimasi sebagai estimasi jadwal rilis bagi BO?"
>
> "Ah, justru itu yang saya takutkan," SM menerangkan dengan semangat, "Estimasi ini untuk memberi tahu tingkat kesulitan kepada non-programmer seperti kita dan juga untuk mengukur deviasi.  Nilai-nilai estimasi tersebut tidak boleh dipakai untuk penjadwalan.  Setiap nilai yang ada disini adalah nilai relatif terhadap nilai sebelumnya."
>
> "Saya baru tahu," PM menjawab singkat sebagai tanda kurang puas, "Lalu mengapa *story* untuk notifikasi memiliki nilai 3? Apakah sulit sekali hanya men-query nilai notifikasi dan menampilkan angka notifikasi?"
>
> "Tidak segampang itu," DEV menjelaskan, "Aplikasi web pada dasarnya satu arah dari sisi klien ke server.  Untuk mengirim notifikasi dari sisi server ke sisi klien, saya perlu menggunakan teknologi seperti WebSocket atau layanan pihak ketiga seperti Pusher.com. Itu baru satu sisi permasalahan, saya juga perlu menentukan sebuah format pesan yang fleksibel sehingga dapat dipakai untuk semua notifikasi yang ada saat ini dan kemudian hari nanti."
>
> "Bila kamu merasa *story*-nya terlalu kompleks, kamu bisa membaginya menjadi beberapa *story* kecil," SM memberikan saran, "Dengan demikian, di setiap Sprint kita tetap bisa melihat perkembangan.  Kami mempercayainya sepenuhnya kepada kamu untuk hal-hal teknis seperti ini."
>
> "Mantap!" jawab DEV.

* *Sprint 2 - Hari 5*
> DEV menemukan ada beberapa *functions* yang sudah tidak dipanggil lagi.  Ia segera menghapusnya tanpa segan.  Selain itu, ia juga memperbaharui beberapa nama variabel karena pada pertemuan terakhir, BO menggunakan terminologi yang berbeda.  "Pada pengembangan *agile*, kode program harus terus diperbaharui," demikian pesan SM, "Bila terdapat *dead code* dan kamu segan untuk mengubah bagian tertentu dari kode program, maka ini adalah pertanda berakhirnya agilitas aplikasi kita."

* *Sprint 2 - Review*
> Setelah BO memperhatikan demo aplikasi, tiba-tiba otak kreatifnya bekerja!  Screen XYZ yang ada di *backlog* sebenarnya bisa digabungkan dengan screen yang sudah ada sekarang.  Ini tentu saja akan membuat aplikasinya lebih mudah dipergunakan!  Ia langsung mengutarakan niatnya.  Baik PM maupun DEV tidak mempermasalahkannya.  Mereka sama-sama merasa ini adalah ide yang baik dan bermanfaat bagi pengguna.

* *Sprint 3 - Hari 3*
> Karena DEV menggunakan *best practise* seperti *dependency injection* dan memakai *interface* tanpa referensi langsung, ia sudah menyelesaikan perubahan yang diminta oleh BO hari ini.  Ia pun memperbaharui *unit test* dan *integration test* sesuai dengan perubahan yang diharapkan.  "Ini sangat merepotkan," pikir DEV, "Tapi juga sangat berguna untuk menjaga kualitas kode program saya."

* *Sprint 3 - Review*
> BO tiba-tiba berkata: "Saya rasa diagram garis ini terlalu mencolok.  Mungkin kita ganti dengan sebuah diagram *pie* saja.  Lalu bagian yang kosong kita isi dengan pesan notifikasi terbaru karena sekarang fitur notifikasi sudah aktif."
>
> Mendengar ini, DEV mengusulkan sesuatu: "Bagaimana kalau kita tidak menghapus diagram garis tersebut tetapi menjadikannya sebagai pop-up?  Pengguna bisa tetap melihatnya bila diperlukan tanpa mengorbankan ruang kosong."
>
> "Ide yang bagus," jawab BO. "Saya tidak sabar ingin melihat hasilnya di Sprint Review berikutnya."

* *Sprint 4 - Hari 2*
> DEV merasa punya banyak waktu luang hari ini.  Walaupun demikian, ia sadar bahwa perilaku menambahkan fitur yang tidak dibutuhkan saat sedang senggang (disebut juga *gold plating*) adalah sesuatu yang tidak baik untuk pengembangan *agile*.  Ia pun menghabiskan waktunya menambah ilmu dengan mengikuti *course* di Udemy dan membaca blog TheSolidSnake.

* *Sprint 4 - Hari 3*
> SM tiba-tiba melakukan *retrospective*.  Ia mengajak DEV untuk berdiskusi secara pribadi di ruangannya.  "Menurutmu apa yang sudah kita lakukan secara benar di pengembangan proyek kita?" tanya SM, "Dan apa yang menurutmu apakah yang bisa kita perbaiki agar lebih baik di kemudian hari?"  DEV pun curhat panjang lebar.

* *Spring 4 - Review*
> Setelah melihat hasil *demo* aplikasi di *staging*, BO bisa merasakan sendiri perkembangannya.  Tanpa bertanya kepada siapapun, ia bisa memberikan estimasi bahwa 80% aplikasi sudah rampung.  Mengapa ia begitu yakin?  Karena hampir semua fitur penting yang harus ada sudah bisa dipakai oleh dirinya sendiri saat *demo*.

* *Sprint 6 - Review*
> Fase pertama untuk aplikasi berhasil diluncurkan!  BO sangat puas dengan hasilnya.  Begitu juga dengan DEV yang mengembangkan aplikasi, ia tidak merasakan beban yang berat.  PM yang paling bahagia karena ia memperoleh bonus besar telah berhasil *closing* tepat waktu.