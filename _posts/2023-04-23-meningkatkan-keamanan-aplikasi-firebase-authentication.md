---
layout: post
category: Pemograman
title: Meningkatkan Keamanan Aplikasi Yang Menggunakan Firebase Authentication
tags: [FirebaseAuthentication, TypeScript]
---

Pada suatu hari, saya diminta untuk membuat sebuah halaman login.  Persyaratannya cukup sederhana: pengguna harus bisa
memasukkan email dan password, bila benar, pengguna akan diarahkan ke halaman utama.  Saya pun segera menulis kode program
yang memanfaatkan Firebase Authentication.  Dengan Firebase Authentication, bahkan pemula sekalipun bisa dengan
mudah membuat halaman login tanpa perlu mengkhawatirkan implementasi OAuth2, JWKS, database dan sejenisnya secara detail.  Namun,
setelah halaman tersebut selesai dan bekerja sebagaimana seharusnya, karena masih ada sisa waktu, saya mulai berpikir: apakah ada hal
lain yang bisa saya lakukan untuk meningkatkan keamanan di halaman login tersebut?  Pada tulisan ini, saya akan mengumpulkan
hasil pencarian saya yang berisi semua hal-hal tambahan yang bisa dilakukan untuk meningkatkan keamanan aplikasi yang menggunakan
Firebase Authentication.  Semua informasi ini juga bisa dijumpai di dokumentasi Firebase Authentication.

---

### Mengaktifkan Email Enumeration Protection

Secara bawaan, bila email yang dimasukkan oleh pengguna belum terdaftar, Firebase Authentication akan mengembalikan respon dengan
pesan `EMAIL_NOT_FOUND`.  Sementara itu, bila email sudah terdaftar namun password-nya salah, Firebase Authentication akan 
mengembalikan pesan `INVALID_PASSWORD`.  Walaupun ini sangat baik untuk *user experience* karena pengguna jadi tahu apa yang salah,
fasilitas ini dapat disalahgunakan oleh pihak yang berniat buruk untuk memeriksa apakah sebuah email adalah email yang terdaftar
di aplikasi yang saya buat.  Setelah mengetahui apakah email valid, pihak dengan niat buruk tersebut bisa menindaklanjuti dengan
mengirim email phising atau memakai password yang pernah bocor dari email tersebut.

Untuk menghindari *email enumeration*, saya dapat memanggil API <https://identitytoolkit.googleapis.com> dengan menyertakan nilai
`true` pada `enable_improved_email_privacy`.  Sebagai contoh, saya dapat melakukan pemanggilan seperti berikut ini:

> <strong>$</strong> <code>export PROJECT_ID=nama-proyek-gcp</code>

> <strong>$</strong> <code>curl -i -X PATCH -d "{'email_privacy_config':{'enable_improved_email_privacy': 'true'}}" \<code><br>
>    <code>-H "Authorization: Bearer $(gcloud auth print-access-token --project $PROJECT_ID)" \<code><br>
>    <code>-H 'Content-Type: application/json' -H "X-Goog-User-Project: $PROJECT_ID" \<code><br>
>    <code>"https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT_ID/config?updateMask=email_privacy_config"</code> 

Bila tidak ada yang salah, saya akan memperoleh respon `200`.  Setelah ini, bila menggunakan email yang tidak terdaftar maupun 
terdaftar, bila password-nya salah, saya akan akan mendapatkan pesan kesalahan `INVALID_LOGIN_CREDENTIALS` yang sama.

---

### Mengaktifkan Multi-Factor Authentication (MFA)

Bila menggunakan Firebase Authentication bersamaan dengan Identity Platform, saya dapat menggunakan SMS sebagai perlindungan
tambahan bila password berhasil diketahui oleh pihak yang tidak bertanggung jawab.  Untuk mengaktifkannya, saya dapat memilih
menu **Sign-in method** dan men-klik tombol **Change** pada bagian *SMS Multi-factor Authentication*.  Saya kemudian mengaktifkan
tombol **Enable** seperti pada gambar berikut ini:

![Mengaktifkan SMS Multi-Factor Authentication]({{ "/assets/images/gambar_00101.png" | relative_url}}){:class="img-fluid rounded"}

Bagian yang lumayan kompleks disini adalah kini saya perlu membuat halaman untuk melakukan registrasi nomor telepon dan juga
melakukan verifikasi kode SMS di halaman login bila pengguna memilih untuk mengaktifkan MFA.

<br>
#### Pendaftaran MFA

Sebelum melakukan registrasi nomor telepon, saya perlu memperbaharui token terlebih dahulu.  Beberapa operasi sensitif di Firebase
Authentication seperti perubahan email juga mensyaratkan token yang segar dan akan gagal dengan pesan kesalahan  
`auth/requires-recent-login` bila usia token sudah terlalu lama (walaupun belum kadaluarsa).  Sebagai contoh, saya membuat
halaman seperti pada gambar berikut ini dimana pengguna perlu memasukkan kembali password-nya:

![Halaman Untuk Pembaharuan Token]({{ "/assets/images/gambar_00102.png" | relative_url}}){:class="img-fluid rounded"}

Untuk memulai proses pembaharuan token, saya dapat memanggil `reauthenticateWithCredential()` seperti pada kode program berikut ini:

```typescript
reauthenticate(password: string): Observable<UserCredential> {
    const user = this.getUser();
    if (user == null) {
        return EMPTY;
    }
    return from(reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, password)));
}
```

Untuk mencegah penyalahgunaan, proses registrasi juga wajib diverifikasi melalui reCAPTCHA.  Firebase Authentication sudah 
menyediakan utilitas untuk ini sehingga saya tidak perlu menyiapkan reCAPTCHA secara manual.  Saya bisa menggunakan `RecaptchaVerifier`
bawaan Firebase seperti pada contoh berikut ini:

```typescript
createCaptchaVerifier(): RecaptchaVerifier {
    const parentDiv = document.getElementById('recaptcha-container-parent');
    if (parentDiv == null) {
        throw new Error(`Can't find element with id 'recaptcha-container-parent' in the page!`);
    }
    const recaptchaContainer = document.createElement('div');
    parentDiv.append(recaptchaContainer);
    return new RecaptchaVerifier(recaptchaContainer, {size: 'invisible'}, this.auth);
}
```

Pada contoh di atas, saya menggunakan reCAPTCHA v2 (*invisible*).  Pada metode ini, tidak ada *checkbox* **I'm not a robot** karena
reCAPTCHA akan berusaha sebisa mungkin melakukan pemeriksaan tanpa perlu interaksi dari pengguna.  Walaupun demikian, pada trafik yang sangat mencurigakan, 
reCAPTCHA tetap akan menampilkan pertanyaan untuk dijawab.  Saya sempat menemukan permasalahan saat melakukan verifikasi reCAPTCHA 
berulang kali pada halaman yang sama dengan pesan kesalahan `ReCAPTCHA has already been rendered in this element`.  Untuk mengatasinya,
pada kode program di atas, saya terpaksa membuat ulang elemen `<div>` untuk reCAPTCHA (dari *parent*-nya) setiap kali memakai `RecaptchaVerifier`.

Sekarang, saya bisa meminta pengguna untuk mengisi nomor telepon dan memulai proses pengiriman kode verifikasi SMS dengan
kode program seperti pada contoh berikut ini:

```typescript
getMultiFactorUser() {
    const user = this.getUser();
    if (user == null) {
        throw new Error('User is empty!');
    }
    return multiFactor(user);
}

getVerificationIdForEnrollment(phoneNumber: string): Observable<string> {
    console.log('Retrieving verification id for enrollment');
    return from(new Promise<string>(async (resolve, reject) => {
        try {
            const session = await this.getMultiFactorUser().getSession();
            const phoneInfoOptions: PhoneMultiFactorEnrollInfoOptions = { phoneNumber, session };
            const phoneAuthProvider = new PhoneAuthProvider(this.auth);
            const verificationId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, this.createCaptchaVerifier());
            console.log('Verification id for enrollment has been retrieved!');
            resolve(verificationId);
        } catch (err) {
            reject(err);
        }
    }));
}
```

Kode program di atas akan mengembalikan sebuah *verification id* yang perlu saya pakai untuk verifikasi.  Nilai ini perlu 
dipadukan dengan kode verifikasi yang diterima oleh pengguna melalui SMS.  Kombinasi dari *verification id* dan *verification code* yang 
dimasukkan oleh pengguna akan dipakai untuk membuat `PhoneAuthCredential`. Untuk memeriksa apakah *verification code* sah, saya dapat
menggunakan `PhoneMultiFactorGenerator.assertion()` dengan melewatkan `PhoneAuthCredential` tersebut.  `PhoneMultiFactorAssertion` yang sah ini 
kemudian akan saya pakai untuk mendaftarkan nomor telepon melalui `MultiFactorUser.enroll()`.  Agar lebih jelas, saya segera 
menulis kode program seperti berikut ini:

```typescript
enroll(verificationId: string, verificationCode: string): Observable<void> {
  console.log('Enrolling MFA code');
  return from(new Promise<void>(async (resolve, reject) => {
    try {
      const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      await this.getMultiFactorUser().enroll(multiFactorAssertion);
      console.log('User MFA has been enrolled!');
      resolve();
    } catch (err) {
      reject(err);
    }
  }));
}
```
<br>
#### Verifikasi MFA Saat Login

Salah satu perubahan pada proses login adalah walaupun sudah memasukkan email dan password secara benar, proses login tetap 
akan gagal dengan kesalahan `MultiFactorError`.  Hal ini akan terjadi pada pengguna yang sebelumnya telah mengaktifkan MFA 
dengan menggunakan `MultiFactorUser.enroll()`.  Ini adalah kesalahan yang unik karena saya dapat menggunakan `MultiFactorError` 
untuk melanjutkan proses login secara normal.  Namun sebelumnya, saya perlu meminta Firebase Authentication 
untuk mengirim kode verifikasi SMS ke pengguna terlebih dahulu dengan kode program seperti berikut ini:

```typescript
getVerificationIdForLogin(err: MultiFactorError): Observable<VerificationIdForLogin> {
  console.log('Retrieving verification id for login');
  return from(new Promise<VerificationIdForLogin>(async (resolve, reject) => {
    try {
      const resolver = getMultiFactorResolver(this.auth, err);
      const phoneInfoOptions: PhoneInfoOptions = {
        multiFactorHint: resolver.hints[0],
        session: resolver.session,
      };
      const phoneAuthProvider = new PhoneAuthProvider(this.auth);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, this.createCaptchaVerifier());
      console.log('Verification id has been retrieved!');
      resolve({err, verificationId});
    } catch (err) {
      reject(err);
    }
  }));
}
```

Setelah meminta pengguna untuk mengisi kode verifikasi di SMS yang diterima, saya bisa menggunakan `MultiFactorResolver.resolveSignIn()`
untuk melanjutkan proses login tanpa perlu mengulang dari awal seperti pada contoh kode program berikut ini:

```typescript
verify(err: MultiFactorError, verificationId: string, verificationCode: string): Observable<UserCredential> {
  console.log('Verifying MFA code');
  return from(new Promise<UserCredential>(async (resolve, reject) => {
    try {
      const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      const resolver = getMultiFactorResolver(this.auth, err);
      const credential = await resolver.resolveSignIn(multiFactorAssertion);
      console.log('MFA code has been verified!');
      resolve(credential);
    } catch (err) {
      reject(err);
    }
  }));
}
```

Bila nilai `verificationCode` yang dimasukkan oleh pengguna benar (sesuai dengan yang diterima di SMS), proses login
akan sukses seperti biasanya.

<br>
#### Unit Testing Yang Melibatkan MFA

Untuk mencegah kuota SMS cepat habis, untuk pengujian secara lokal, saya dapat menggunakan Firebase Emulator.  Bila Firebase
Authentication aktif di Firebase Emulator, setiap kali saya meminta kode verifikasi, tidak akan ada SMS yang dikirim ke nomor
telepon yang bersangkutan.  Sebagai gantinya, kode verifikasi yang harus dimasukkan akan muncul di terminal yang menjalankan
Firebase Emulator.

Selain itu, pada *unit testing* yang otomatis, saya tetap dapat mengakses kode verifikasi melalui 
URL `http://localhost:9099/emulator/v1/projects/demo-jocki/verificationCodes`.  Sebagai contoh, berikut ini adalah contoh 
skenario *unit test* Angular yang menguji alur pendaftaran MFA dan login MFA:

```typescript
function findVerificationCode<V>(verificationId: V): Observable<{id: V, code: string}> {
  const vid = (typeof verificationId === 'string') ? verificationId : (verificationId as any).verificationId;
  return http.get<VerificationCodes>('http://localhost:9099/emulator/v1/projects/demo-jocki/verificationCodes').pipe(
    map(v => ({
      id: verificationId,
      code: v.verificationCodes.find(v => v.sessionInfo == vid)?.code ?? '',
    })),
  );
}

it('should return valid verification id for login through MultiFactorError', (done) => {
    service.login('owner@jocki.me', '12345678').pipe(
        mergeMap(() => service.getVerificationIdForEnrollment('+6212345678')),
        mergeMap(verificationId => findVerificationCode(verificationId)),
        mergeMap(v => service.enroll(v.id as string, v.code)),
        mergeMap(() => service.login('owner@jocki.me', '12345678')),
        catchError(err => {
            expect(err.code).toBe(AuthErrorCodes.MFA_REQUIRED);
            return service.getVerificationIdForLogin(err);
        }),
        mergeMap(verificationId => findVerificationCode<VerificationIdForLogin>(verificationId as VerificationIdForLogin)),
        mergeMap(v => service.verify(v.id.err, v.id.verificationId, v.code))
    ).subscribe( (userCredential) => {
        expect(userCredential.operationType).toBe("signIn");
        expect(userCredential.user.email).toBe('owner@jocki.me');
        done();
    });
});
```

Bila ingin melakukan pengujian langsung ke server Firebase dan ingin menghemat kuota SMS, pada dashboard Firebase Authentication,
saya juga dapat menambahkan nomor telepon yang di-*hardcode* agar selalu mengirimkan kode verifikasi yang telah saya tentukan.

---

<br>
#### Mengatur Seberapa Lama Status Authentication Disimpan

Secara default, Firebase Authentication akan menyimpan status *authentication* di *browser* walaupun *browser* sudah ditutup
(selama pengguna tidak *logout* secara eksplisit).  Ini akan membuat pengguna merasa lebih nyaman karena tidak perlu
sering kali *login* (termasuk memasukkan kode verifikasi SMS dan sebagainya).  Namun, untuk aplikasi yang lebih sensitif, saya
dapat mengubah perilaku ini dengan memanggil `setPersistence()` dengan melewatkan salah satu `Persistence` berikut ini:
* `browserLocalPersistence` untuk menyimpan status *authentication* hingga pengguna melakukan *logout* secara eksplisit.
* `browserSessionPersistence` untuk menyimpan status *authentication* hingga *tab* atau *browser* ditutup.
* `inMemoryPersistence` untuk tidak menyimpan status *authentication* sama sekali.  Begitu halaman di-*refresh*, pengguna perlu login kembali.

Sebagai contoh, saya dapat menggunakan `inMemoryPersistence` seperti pada kode program berikut ini:

```typescript
import {browserSessionPersistence} from '@angular/fire/auth';
import {setPersistence} from '@firebase/auth';

login(email: string, password: string): Observable<UserCredential> {
    return from(setPersistence(this.auth, inMemoryPersistence)).pipe(
        mergeMap(() => signInWithEmailAndPassword(this.auth, email, password))
    );
}
```

Sekarang, seusai login, saya masih tetap bisa memakai aplikasi seperti biasanya.  Namun begitu saya memperbaharui halaman (dengan 
men-klik icon Refresh atau F5), saya akan diminta untuk login kembali.  Walaupun paling merepotkan bagi pengguna, `inMemoryPersistence` adalah 
konfigurasi yang paling aman karena *token* sama sekali tidak disimpan di-*browser* seperti yang terlihat pada gambar berikut ini:

![Tidak Ada Yang Disimpan Di Local Storage Maupun Session Storage]({{ "/assets/images/gambar_00103.png" | relative_url}}){:class="img-fluid rounded"}

Beberapa jenis serangan *session hijacking* menggunakan celah XSS untuk mengerjakan JavaScript yang kemudian membaca token 
yang tersimpan di browser.  Bila tidak ada *token* yang tersimpan di *browser* yang dapat dibaca melalui JavaScript, maka 
teknik serangan seperti ini tidak akan bisa dipakai.

---

<br>
#### Mendeteksi Aktifitas Mencurigakan Berdasarkan IP

Bila terdapat perbedaan antara IP saat pengguna login dengan IP saat token dipakai, bisa jadi token tersebut telah dicuri.  Firebase 
Authentication mendukung pemeriksaan seperti ini secara *stateless* tanpa perlu database tersendiri dengan memanfaatkan *claim* di JWT.  
Seperti yang ditentukan oleh spesifikasi [RFC 7519](https://www.ietf.org/rfc/rfc7519.txt), sebuah token JWT dapat mengandung satu atau
lebih *claim*.  Ada beberapa *claim* yang harus selalu ada di JWT seperti `iss`, `sub`, `aud`, `exp` dan sebagainya. Mereka disebut 
sebagai *registered claims*.  Selain itu, asalkan pihak yang berkomunikasi dapat saling memahami, JWT juga boleh mengandung *claim*
tambahan yang disebut sebagai *private claims*.  Firebase Authentication menyebutnya sebagai *custom claims*.

Sebagai tambahan, selain *custom claims*, Firebase Authentication juga mendukung apa yang disebut *session claims*.  Ini adalah *claim*
yang tidak akan disimpan secara permanen dan akan hilang saat *session* pengguna berakhir (misalnya saat token kadaluarsa atau 
pengguna memilih *logout*).  Nilai *session claims* hanya bisa ditambahkan oleh *blocking functions* `beforeSignIn`.  Sebagai contoh,
saya akan membuat *blocking functions* seperti berikut ini:

```typescript
import {beforeUserSignedIn} from 'firebase-functions/v2/identity';

export const before = beforeUserSignedIn((event) => {
    return {
        sessionClaims: {
            signInIPAddress: event.ipAddress,
        },
    };
});
```

Sekarang, setiap kali token dihasilkan, akan ada informasi `signInIPAddress` yang berisi informasi IP klien yang 
membuat token tersebut, seperti yang terlihat pada gambar berikut ini:

![Session Claim Baru Di JWT]({{ "/assets/images/gambar_00104.png" | relative_url}}){:class="img-fluid rounded"}

Selanjutnya, untuk mempermudah melakukan verifikasi alamat IP di seluruh *callable functions* yang ada, saya akan membuat
sebuah *currying function* seperti berikut ini:

```typescript
import {getAuth} from 'firebase-admin/auth';
import {CallableRequest, HttpsError} from 'firebase-functions/v2/https';

export const verifyIP = <T>(handler: (r: CallableRequest) => Promise<T>) => async (req: CallableRequest) => {
    const tokenIP = req.auth?.token?.signInIPAddress;
    if (tokenIP != null) {
        const requestIP = req.rawRequest.ip;
        const uid = req.auth?.uid;
        console.log(`Token IP [${tokenIP}] Request IP [${requestIP}] UID [${uid}]`);
        if (requestIP && uid && (tokenIP !== requestIP)) {
            console.log(`Revoking refresh tokens for [${uid}]`);
            await getAuth().revokeRefreshTokens(uid);
            throw new HttpsError('unauthenticated', 'Unauthorized access');
        }
    }
    return handler(req);
};
```

Kode program di atas pada dasarnya akan membandingkan IP yang tercantum di JWT dengan IP dari *socket* saat pemanggilan
*function*.  Bila terdapat perbedaan, seluruh token yang aktif untuk pengguna tersebut akan di-*revoke*.  Ini berarti bukan
hanya pencuri token saja yang akan menemukan pesan kesalahan, pemilik akun yang sah juga akan dipaksa untuk login kembali.

Saya bisa menerapkan *currying function* tersebut ke seluruh *callable functions* yang ada seperti pada contoh berikut ini:

```typescript
export const api1 = onCall({maxInstances: 1}, verifyIP(async (request) => { ... }));
export const api2 = onCall({maxInstances: 1}, verifyIP(async (request) => { ... }));
```

Untuk menguji apakah kode program yang saya buat bekerja dengan baik, saya akan melakukan langkah-langkah seperti berikut ini:
1. Pada browser Chrome, buka tab *Network* untuk men-*capture* seluruh *request* dari browser.
2. Login sebagai user yang sah dan buka halaman yang melakukan pemanggilan *callable function*.
3. Pilih salah satu *request* yang mewakili pemanggilan *callable function*, pastikan terdapat header `authorization` pada *request* tersebut.  
Klik kanan pada *request* dan pilih **Copy**, **Copy as cURL**.
4. Pada dashboard GCP, buka Cloud Shell.  Ini akan membuka terminal baru di mesin *remote* dengan IP yang dinamis.  Tempelkan hasil pada
perintah sebelumnya dan tekan Enter untuk mengerjakan perintah cURL tersebut.
5. Pastikan untuk mendapatkan kembalian dengan status `401` dan pesan kesalahan seperti `{"error":{"message":"Unauthorized access","status":"UNAUTHENTICATED"}}`.

<div class="alert alert-warning" role="alert">
Melakukan troubleshooting dengan membagikan perintah cURL berisi <em>authorization header</em> bukanlah perilaku yang aman.  Sebagai alternatif, 
platform sebaiknya mendukung fasilitas <em>user impersonation</em> dimana pihak yang terlibat dalam troubleshooting
dapat menggunakan token milik mereka masing-masing untuk berperan sebagai pengguna.  Dengan demikian, audit log akan mencatat token
milik developer beserta token milik pengguna yang disimulasikannya.  Karena token hasil <em>user impersonation</em> ini berbeda dari
token yang biasa dipakai pengguna, platform juga dapat mengenali user mana saja yang sedang di-<em>impersonate</em> dengan mudah.
</div>

Walaupun teknik perbandingan IP terlihat efektif, ia akan menimbulkan masalah bagi pengguna yang sedang dalam perjalanan atau
pengguna yang menggunakan koneksi telepor seluler dengan IP yang sangat dinamis.  Mereka akan jadi lebih sering diminta untuk login
kembali.  Untuk mengatasi hal ini, saya dapat meningkatkan kode program, misalnya dengan memeriksa apakah IP dari
dua negara yang berbeda, apakah IP bukan salah satu IP yang biasa dipakai selama 30 hari terakhir, apakah IP selalu berubah
dalam waktu singat, dan sebagainya.
