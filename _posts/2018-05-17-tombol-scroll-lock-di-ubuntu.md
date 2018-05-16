---
layout: post
category: OS
title: Tombol Scroll Lock Di Ubuntu
tags: [Ubuntu]
---

Keyboard yang saya pakai memiliki *backlit* (pencahayaan) yang dapat dinyalakan dan dimatikan melalui tombol Scroll Lock.  Sama sekali tidak ada masalah pada saat saya mencobanya di Windows.  Akan tetapi, saat menggunakan keyboard yang sama di Ubuntu, tombol Scroll Lock seolah-olah tidak bekerja.  Saya segera  melakukan pencarian di Google; ternyata bukan hanya saya, masalah ini sudah dialami banyak pengguna Ubuntu lainnya.

Dari hasil pencarian, untuk menyalakan *backlit* keyboard di Ubuntu, saya dapat memberikan perintah berikut ini di terminal:

    xset led named "Scroll Lock"

Sebagai kebalikannya, untuk mematikan lampu keyboard, saya menggunakan perintah berikut ini di terminal:

    xset -led named "Scroll Lock"

Kedua perintah di atas akan menyalakan dan mematikan lampu keyboard terlepas dari apakah tombol Scroll Lock di keyboard di tekan atau tidak.

Tentu saja akan sangat merepotkan bila saya harus masuk ke terminal terlebih dahulu untuk menyalakan dan mematikan lampu keyboard.  Jalan keluar lain yang bisa saya coba adalah menggunakan perintah berikut ini di terminal:

    xmodmap -e 'add mod3 = Scroll_Lock'

Sekarang, saya bisa menyalakan dan mematikan *backlit* keyboard melalui tombol fisik Scroll Lock.

Walaupun demikian, solusi ini hanya berlaku sementara sampai saya mematikan komputer.  Begitu memulai ulang Ubuntu, tombol Scroll Lock kembali tidak bekerja. Saya harus kembali memberikan perintah `xmodmap` agar tombol Scroll Lock kembali bisa mengatur *backlit*.

Solusi lain yang lebih permanen adalah dengan mengubah pemetaan *symbols* milik xkb di direktori `/usr/share/X11/xkb/symbols`.  Direktori ini berisi file konfigurasi pemetaan *symbols*  yang dikelompokkan dalam kode negara.  Untuk melihat kode negara yang aktif (yang sedang saya pakai) di keyboard saat ini, saya memberikan perintah berikut ini:

    setxkbmap -query


Pada keyboard saya, nilai `layout` adalah `us`.  Oleh sebab itu, saya akan mengubah file `/usr/share/X11/xkb/symbols/us` dengan menambahkan baris berikut ini pada file tersebut:

    ...
    xkb_symbols "basic" {

      name[Group1]= "English (US)";   
      ...
      modifier_map Mod3 { Scroll_Lock };
    };
    ...

*Tips:  Jangan sampai salah mengubah file ini karena bisa menyebabkan OS tidak mau menerima masukan dari keyboard lagi.*

Sekarang, setelah menjalankan ulang Ubuntu, tombol Scroll Lock kini dapat dipakai untuk menyalakan dan mematikan lampu keyboard seperti seharusnya.  Walaupun demikian, solusi ini tidak sempurna.  Saat melakukan upgrade Ubuntu, saya sering kali menjumpai perubahan yang saya lakukan pada file `us` sudah hilang sehingga saya harus mengulangi langkah dalam artikel ini kembali.

Test Java:

```java
public static void main() {
  System.out.println("test");
}
```