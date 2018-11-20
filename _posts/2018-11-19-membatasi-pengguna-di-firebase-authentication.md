---
layout: post
category: Pemograman
title: Membatasi Pengguna Yang Mendaftar Melalui Firebase Authentication
tags: [FirebaseAuthentication, FirebaseFunction, Firebase]
---

Pada sebuah proyek Angular, saya menggunakan Firebase Authentication, tepatnya FirebaseUI, sebagai halaman *sign-in* dan *sign-up*.  Fitur ini mirip seperti Universal Login di Auth0, hanya saja FirebaseUI di-*host* pada aplikasi yang sama sementara Universal Login di Auth0 membutuhkan biaya tambahan untuk *custom domain*.  Dengan FirebaseUI, saya mendapatkan halaman berikut ini tanpa banyak menulis kode program:

![Tampilan Halaman Login FirebaseUI]({{ "/assets/images/gambar_00020.png" | relative_url}}){:class="img-fluid rounded"}

Walaupun terlihat seperti halaman *sign-in*, sebenarnya halaman di atas juga berperan sebagai *sign-up* pengguna baru.  Siapa saja bisa *login* ke dalam aplikasi asalkan memiliki akun Google, Facebook, Twitter, atau Github.  Begitu juga dengan *sign-in* menggunakan email dan password.  Bila email yang saya masukkan belum terdaftar, pengguna akan dibawa ke halaman seperti berikut ini:

![Tampilan Halaman Pendaftaran Pengguna]({{ "/assets/images/gambar_00021.png" | relative_url}}){:class="img-fluid rounded"}

Hal ini memang masuk akal mengingat pada OAuth2, pengguna yang berhasil di-verifikasi oleh *authentication provider* adalah pengguna yang valid.  Akan tetapi pada kondisi tertentu, ada saatnya saya tidak ingin membiarkan semua orang mendaftarkan dirinya pada aplikasi web saya secara bebas.  Sebagai contoh, pada awal pengembangan aplikasi, saya mungkin hanya ingin pengguna yang telah di-undang saja yang boleh masuk ke dalam aplikasi.  Pada Auth0, hal ini dapat dicapai dengan menulis *rule* baru.  Lalu bagaimana dengan Firebase Authentication?  Saya bisa menggunakan logika yang hampir sama seperti *rule* di Auth0 melalui trigger Firebase Functions yang dikerjakan pada saat pendaftaran user baru berhasil dilakukan.  *Catatan:  Cara ini tidak seenak menggunakan rule di Auth0!*

Sebagai latihan, saya menambahkan sebuah Firebase Function dalam bahasa TypeScript.  Ini adalah kode program *trigger* yang akan dikerjakan pada saat user baru dibuat (*sign-up*).  Isinya terlihat seperti berikut ini:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp(functions.config().firebase);

// noinspection JSUnusedGlobalSymbols
export const checkForWhitelistedEmails = functions.auth.user().onCreate(user => {
    const email = user.email;
    const whitelistedEmails = ['user@jocki.me'];
    if (email && whitelistedEmails.includes(email)) {
        const customClaims: any = user.customClaims;
        if (!customClaims || !customClaims.whitelisted) {
            return admin.auth().setCustomUserClaims(user.uid, {whitelisted: true});
        }
    }
    return null;
});
```

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Berbeda dengan kebanyakan fitur Firebase lainnya yang dijalankan di <em>front-end</em>, Firebase Function adalah kode program yang dikerjakan di-sisi <em>server</em>.  Firebase Function dapat dipakai sebagai jembatan antara Google Cloud Platform dan Firebase melalui Cloud Pub/Sub.  Sebagai contoh, Firebase Function bisa menjadi trigger Cloud Pub/Sub untuk pesan yang dipublikasikan oleh komponen Google Cloud Platform seperti App Engine, Cloud DataFlow, dan sebagainya.
</div>

*Function* di atas akan menambahkan *custom claim* dengan nama `whitelisted` dan nilai `true` bila email yang didaftarkan adalah `user@jocki.me`.  Dengan demikian, walaupun semua pengguna yang *login* akan terdaftar di Firebase Authentication, hanya ada satu pengguna yang memiliki nilai `whitelisted: true`.  Ini adalah pengguna yang boleh mengakses aplikasi, sementara untuk pengguna yang tidak memiliki *custom claim* ini, saya bisa menampilkan informasi seperti *"maaf, kami baru membuka pendaftaran untuk mereka yang diundang"*.

Salah satu perbedaan metode ini dibandingkan dengan menggunakan *rule* di Auth0 adalah *function* di atas dikerjakan setelah *token* dikembalikan ke aplikasi web.  Hal ini cukup merepotkan karena prosesnya yang *asynchronous*; tidak seperti Auth0 dimana setelah semua *rule* selesai dikerjakan, *token* baru dikembalikan ke aplikasi web.  Saya perlu melakukan beberapa hal di aplikasi web setelah *function* ini selesai dikerjakan di sisi *server*.  Salah satunya adalah saya perlu menginstruksikan aplikasi web untuk meminta *token* terbaru yang telah dilengkapi *custom claim*.

Untungnya, saya bisa menyontek contoh kode program yang ada di <https://firebase.google.com/docs/auth/admin/custom-claims#defining_roles_via_firebase_functions_on_user_creation>.  Seperti layaknya programmer lain yang baik, saya tidak akan menyalin kode program tersebut begitu saja (walaupun bisa bekerja!).  Hal ini karena kode program tersebut mengasumsikan penggunaan Firebase JavaScript SDK, padahal saya sudah menyertakan Firebase Angular2 yang menyediakan abstraksi diatasnya yang lebih *'akrab'* bagi programmer Angular.  Sebagai contoh, *promise* dan *callback* sangat jarang dipakai di Angular karena peran mereka digantikan oleh ReactiveX JS (RxJS).

Saya akan mulai dengan membuat sebuah *service* baru di Angular 7 dengan isi seperti berikut ini:

```typescript
import {Injectable} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/auth';
import {AngularFireDatabase} from '@angular/fire/database';
import {EMPTY, from, Observable} from 'rxjs';
import {map, switchMap, tap} from 'rxjs/operators';
import {User} from 'firebase';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private _currentUser: User;

  constructor(private auth: AngularFireAuth, private db: AngularFireDatabase) {
    this.user.pipe(
      tap(user => this._currentUser = user),
      switchMap(user => {
        return user ? this.db.object(`metadata/${user.uid}/refreshTime`).valueChanges() : EMPTY;
      })
    ).subscribe(() => {
      this._currentUser.getIdToken(true);
    });
  }

  get currentUser(): User {
    return this._currentUser;
  }

  get user(): Observable<User> {
    return this.auth.authState;
  }

  isWhitelisted(user: User): Observable<boolean> {
    return from(user.getIdTokenResult()).pipe(
      map(idTokenResult => {
        return !!idTokenResult.claims.whitelisted;
      })
    );
  }

  logout(): Promise<void> {
    return this.auth.auth.signOut();
  }

}
```

Pada *constructor* di `AuthService`, saya mendengarkan setiap perubahan `User` melalui `authState` (sebuah `Observable`) yang disediakan oleh `AngularFireAuth`.  Dengan demikian, setiap kali pengguna *login* atau *logout*, *subscription* ini akan dikerjakan.  Ingat bahwa ini adalah *single page application*!  Lalu mengapa *subscription* tersebut tidak perlu di-*unsubscribe*?  Karena *subscription* ini penting untuk selalu ada hingga aplikasi selesai (misalnya hingga pengguna menutup tab website dari browser).  

Penggunaan operator `switchMap()` membuat logika *subscription* ini menjadi seperti: bila ada `User` yang baru *login*, hapus *subscription* untuk `User` sebelumnya, lalu buat *subscription* baru untuk menunggu hingga *ref* yang telah ditentukan untuk `User` tersebut berubah (dengan kata lain Firebase Realtime Database diperbaharui oleh kode program Firebase Functions).

Sekarang, saya hanya perlu menyuntikkan `AuthService` ke *component* yang membutuhkannya melalui fasilitas *dependency injection* di Angular. Saya bisa menggunakan property `user` untuk mendengarkan perubahan `User` lalu membaca informasi seperti email (`user.email`), nama (`user.displayName`) dan foto (`user.photoURL`).  Selain itu, saya bisa memanggil method `isWhitelisted()` untuk memeriksa apakah `User` tersebut sudah di-*whitelist* atau belum.  Pada kode program `isWhitelisted()`, saya menggunakan `from()` dari RxJS untuk menerjemahkan `Promise` menjadi `Observable` dengan asumsi bahwa programmer Angular lebih terbiasa dengan `Observable` :)

Sekarang, bila ada pengguna yang mencoba login dengan menggunakan akun yang tidak di-*whitelist*, saya bisa menampilkan halaman seperti berikut ini:

![Tampilan Halaman Pengguna Yang Belum Di-Whitelist]({{ "/assets/images/gambar_00022.png" | relative_url}}){:class="img-fluid rounded"}

Pengguna sesungguhnya sudah terdaftar di aplikasi.  Ia dapat dijumpai di *dashboard* Firebase Authentication.  Saya juga bisa menampilkan informasi seperti email dan fotonya di aplikasi.  Yang saya lakukan hanyalah membatasi pengguna hingga pada halaman *dashboard* sehingga tidak ada yang bisa dilakukan dirinya.  Tentu saja, verifikasi yang sama (untuk *custom claim*) juga perlu dilakukan di sisi server saat menerima JWT.