---
layout: post
category: Pemograman
title: Melakukan Query DNS Lewat HTTPS
tags: [JavaScript, DNS]
---

Salah satu hal menarik dari *DNS Resolver* Cloudflare yang diluncurkan 1 April 2018 kemarin adalah ia bisa dipanggil melalui HTTPS.  Ini adalah apa yang disebut sebagai DNS over HTTPS (DoH).  Selain Cloudflare, *DNS Resolver* dari Google juga mendukung DoH.  Bukan hanya itu, juga sudah tersedia website untuk pencarian hasil query DNS di <https://dns.google.com>.

Berbeda dengan DNSCrypt, DoH lebih mudah dipakai diberbagai platform karena hampir semua platform menyediakan API untuk melakukan request HTTPS.  Sebagai latihan, kali ini saya melakukan *query DNS* melalui DoH dengan JavaScript.  Kode program dan hasil akhirnya dapat dilihat pada halaman ini.

<style>
.spinner {
  margin-left: 10px;  
  width: 70px;
  text-align: center;
}

.spinner > div {
  width: 10px;
  height: 10px;
  background-color: #333;

  border-radius: 100%;
  display: inline-block;
  -webkit-animation: sk-bouncedelay 1.4s infinite ease-in-out both;
  animation: sk-bouncedelay 1.4s infinite ease-in-out both;
}

.spinner .bounce1 {
  -webkit-animation-delay: -0.32s;
  animation-delay: -0.32s;
}

.spinner .bounce2 {
  -webkit-animation-delay: -0.16s;
  animation-delay: -0.16s;
}

@-webkit-keyframes sk-bouncedelay {
  0%, 80%, 100% { -webkit-transform: scale(0) }
  40% { -webkit-transform: scale(1.0) }
}

@keyframes sk-bouncedelay {
  0%, 80%, 100% { 
    -webkit-transform: scale(0);
    transform: scale(0);
  } 40% { 
    -webkit-transform: scale(1.0);
    transform: scale(1.0);
  }
}
</style>

<h4 class="mt-5">Informasi IP Address Kamu</h4>

<div class="table-responsive mb-3">
	<table id="userInformation" class="table table-hover">				
		<tbody>
			<tr id="ip-address">
				<th scope="row" class="w-25">IP address</th>
				<td>
					<div class="spinner">
						<div class="bounce1"></div>
						<div class="bounce2"></div>
						<div class="bounce3"></div>
					</div>
					<div class="value"></div>
				</td>
			</tr>
			<tr id="organization">
				<th scope="row" class="w-25">Organisasi</th>
				<td>
					<div class="spinner">
						<div class="bounce1"></div>
						<div class="bounce2"></div>
						<div class="bounce3"></div>
					</div>
					<div class="value"></div>
				</td>
			</tr>
		</tbody>
	</table>
</div>


<h4 class="mt-5">Pencarian DNS Lewat HTTPS</h4>

<div class="input-group">
	<input type="text" id="domainName" class="form-control" placeholder="Masukkan nama domain yang dicari">
	<div class="input-group-append">
		<button id="search" class="btn btn-primary" type="button">Cari</button>
	</div>
</div>

<div class="table-responsive my-3">
	<table id="responseInformation" class="table table-hover">
		<tbody>
			<tr id="dns-ip">
				<th scope="row" class="w-25">IP Address</th>
				<td>
					<div class="spinner">
						<div class="bounce1"></div>
						<div class="bounce2"></div>
						<div class="bounce3"></div>
					</div>
					<div class="value">-</div>
				</td>
			</tr>
			<tr id="dns-organization">
				<th scope="row" class="w-25">Organisasi</th>
				<td>
					<div class="spinner">
						<div class="bounce1"></div>
						<div class="bounce2"></div>
						<div class="bounce3"></div>
					</div>
					<div class="value">-</div>
				</td>
			</tr>
			<tr id="resolver-ip">
				<th scope="row" class="w-25">IP DNS Resolver</th>
				<td>
					<div class="spinner">
						<div class="bounce1"></div>
						<div class="bounce2"></div>
						<div class="bounce3"></div>
					</div>
					<div class="value">-</div>
				</td>
			</tr>
			<tr id="resolver-country">
				<th scope="row" class="w-25">Negara DNS Resolver</th>
				<td>
					<div class="spinner">
						<div class="bounce1"></div>
						<div class="bounce2"></div>
						<div class="bounce3"></div>
					</div>
					<div class="value">-</div>
				</td>
			</tr>
			<tr id="resolver-isp">
				<th scope="row" class="w-25">ISP DNS Resolver</th>
				<td>
					<div class="spinner">
						<div class="bounce1"></div>
						<div class="bounce2"></div>
						<div class="bounce3"></div>
					</div>
					<div class="value">-</div>
				</td>
			</tr>
		</tbody>
	</table>	
</div>

<script>
	function setValue(id, value, extraClass) {
		var element = document.getElementById(id);
		$(element).find(".spinner").hide();
		$(element).find(".value").text(value).show();
		if (extraClass) {
			$(element).addClass(extraClass);
		}
	}

	function refreshUserIP() {		
		$("#userInformation .value").hide();
		$("#userInformation .spinner").show();
		jQuery.getJSON("https://api.ipify.org?format=jsonp&callback=?").then(function(json) {
			setValue("ip-address", json.ip);
			return Promise.resolve(json.ip);
		}).then(function(ip) {			
			return jQuery.get("http://whois.arin.net/rest/ip/" + ip, {}, null,"json");
		}).then(result => {				
			setValue("organization", result.net.orgRef['@name']);						
		});		
	}

	function searchDomain(domainName) {
		$("#responseInformation .value").hide();
		$("#responseInformation .spinner").show();
		jQuery.get("https://cloudflare-dns.com/dns-query?ct=application/dns-json&name=maxmind.test-ipv6.com&type=TXT").then(result => {			
			var ip = 'Not Found', isp = 'Not Found', country = 'Not Found';
			if (result.Status === 0) {
				var answer = result.Answer[0].data.slice(1, -1);
				var data = answer.split(/ +(?=[\w]+=)/g);
				for (var i = 0; i < data.length; i++) {					
					var field = data[i].split("=");
					var value = field[1].slice(1, -1);
					if (field[0] === 'ip') {
						ip = value;
					} else if (field[0] === 'isp') {
						isp = value;
					} else if (field[0] === 'country') {
						country = value;
					}
				}				
			} 
			setValue('resolver-ip', ip);
			setValue('resolver-isp', isp);
			setValue('resolver-country', country);			
		});
		jQuery.get("https://cloudflare-dns.com/dns-query?ct=application/dns-json&name=" + domainName + "&type=A").then(result => {			
			var ip = 'Not Found', organization = 'Not Found';
			if (result.Status === 0) {
				for (var i=0; i<result.Answer.length; i++) {
					var answer = result.Answer[i];
					if (answer.type === 1) {
						ip = answer.data;		
						break;
					}
				}				
			}
			setValue('dns-ip', ip);
			return Promise.resolve(ip);
		}).then(ip => {
			if (ip !== 'Not Found') {
				return jQuery.get("http://whois.arin.net/rest/ip/" + ip, {}, null, "json");
			} else {
				return Promise.resolve(null);			
			}
		}).then(result => {
			if (result == null)	{
				setValue("dns-organization", "Not Found");
			} else {
				setValue("dns-organization", result.net.orgRef['@name']);
			}			
		});		
	}

	window.onload = function() {	
		$("#search").click(function() {
			var domainName = $("#domainName").val();
			if (domainName) {
				searchDomain(domainName);
			}
		});
		$(".spinner").hide();
		refreshUserIP();
	};	
</script>

<div class="accordion" id="accordion">
	<div class="card">
		<div class="card-header">
			<h5>
				<button  class="btn btn-link" type="button" data-toggle="collapse" data-target="#kodeProgram" aria-expanded="false" aria-controls="kodeProgram">
					Kode Program
				</button>
			</h5>
		</div>
		<div id="kodeProgram" class="collapse" data-parent="#accordion">
			<div class="card-body">
								
{% highlight javascript %}
function setValue(id, value, extraClass) {
	var element = document.getElementById(id);
	$(element).find(".spinner").hide();
	$(element).find(".value").text(value).show();
	if (extraClass) {
		$(element).addClass(extraClass);
	}
}

function refreshUserIP() {		
	$("#userInformation .value").hide();
	$("#userInformation .spinner").show();
	jQuery.getJSON("https://api.ipify.org?format=jsonp&callback=?").then(function(json) {
		setValue("ip-address", json.ip);
		return Promise.resolve(json.ip);
	}).then(function(ip) {			
		return jQuery.get("http://whois.arin.net/rest/ip/" + ip, {}, null,"json");
	}).then(result => {				
		setValue("organization", result.net.orgRef['@name']);						
	});		
}

function searchDomain(domainName) {
	$("#responseInformation .value").hide();
	$("#responseInformation .spinner").show();
	jQuery.get("https://cloudflare-dns.com/dns-query?ct=application/dns-json&name=maxmind.test-ipv6.com&type=TXT").then(result => {			
		var ip = 'Not Found', isp = 'Not Found', country = 'Not Found';
		if (result.Status === 0) {
			var answer = result.Answer[0].data.slice(1, -1);
			var data = answer.split(/ +(?=[\w]+=)/g);
			for (var i = 0; i < data.length; i++) {					
				var field = data[i].split("=");
				var value = field[1].slice(1, -1);
				if (field[0] === 'ip') {
					ip = value;
				} else if (field[0] === 'isp') {
					isp = value;
				} else if (field[0] === 'country') {
					country = value;
				}
			}				
		} 
		setValue('resolver-ip', ip);
		setValue('resolver-isp', isp);
		setValue('resolver-country', country);			
	});
	jQuery.get("https://cloudflare-dns.com/dns-query?ct=application/dns-json&name=" + domainName + "&type=A").then(result => {			
		var ip = 'Not Found', organization = 'Not Found';
		if (result.Status === 0) {
			for (var i=0; i<result.Answer.length; i++) {
				var answer = result.Answer[i];
				if (answer.type === 1) {
					ip = answer.data;		
					break;
				}
			}				
		}
		setValue('dns-ip', ip);
		return Promise.resolve(ip);
	}).then(ip => {
		if (ip !== 'Not Found') {
			return jQuery.get("http://whois.arin.net/rest/ip/" + ip, {}, null, "json");
		} else {
			return Promise.resolve(null);			
		}
	}).then(result => {
		if (result == null)	{
			setValue("dns-organization", "Not Found");
		} else {
			setValue("dns-organization", result.net.orgRef['@name']);
		}			
	});		
}

window.onload = function() {	
	$("#search").click(function() {
		var domainName = $("#domainName").val();
		if (domainName) {
			searchDomain(domainName);
		}
	});
	$(".spinner").hide();
	refreshUserIP();
};
{% endhighlight %}				
			</div>
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<h5>
				<button  class="btn btn-link" type="button" data-toggle="collapse" data-target="#penjelasan" aria-expanded="true" aria-controls="penjelasan">
					Penjelasan
				</button>
			</h5>
		</div>
		<div id="penjelasan" class="collapse" data-parent="#accordion">
			<div class="card-body">
				<p>
Tidak ada yang spesial pada kode program ini karena pada dasarnya saya hanya memanggil layanan yang sudah ada dengan <code>jQuery.get()</code> dan <code>jQuery.getJson()</code>.  Cukup lama rasanya sejak terakhir kali memakai jQuery :)  Selain itu, saya juga tidak berani memakai fitur ES2016 seperti keyword <code>const</code> dan string interpolation (dengan memakai tanda <em>backtick</em> sebagai pengganti kutip di string) karena tanpa batuan Babel atau TypeScript, tidak semua browser bisa menjalankan kode program yang sama.  Untuk animasi <em>spinner</em>, saya menggunakan CSS3 yang kode-nya saya ambil dari <a href="http://tobiasahlin.com/spinkit/">http://tobiasahlin.com/spinkit/</a>.
				</p>
				<p>
Untuk mendapatkan IP publik pengguna, saya memanggil <a href="https://api.ipify.org">https://api.ipify.org</a> yang akan mengembalikan JSONP.  Setelah itu, setelah mendapatkan IP publik, saya memanggil <a href="http://whois.arin.net/rest/ip/">http://whois.arin.net</a> guna mendapatkan informasi lebih lanjut mengenai IP tersebut.  Karena sudah terbiasa memakai <code>Promise</code> dan kebetulan hasil kembalian <code>jQuery.get()</code> dan <code>jQuery.getJson()</code> kompatibel dengan <code>Promise</code>, maka saya melakukan <em>chaining</em> <code>then</code> pada kode program.
				</p>
				<p>
Untuk mendapatkan <em>IPv4 address</em> dari domain yang dimasukkan oleh pengguna, saya memanggil <a href="https://cloudflare-dns.com">https://cloudflare-dns.com/dns-query?ct=application/dns-json</a>.  Sama seperti sebelumnya, saya juga memanggil <a href="http://whois.arin.net/rest/ip/">http://whois.arin.net</a> untuk mendaftarkan informasi lebih lanjut mengenai IP yang ditemukan.  Selain itu, saya juga menggunakan Cloudflare DNS untuk mendapatkan record TXT dari <code>maxmind.test-ipv6.com</code> untuk memastikan bahwa <em>DNS resolver</em> yang bekerja adalah Cloudflare.  Sayang sekali browser tidak memungkinkan membuat socket UDP untuk alasan keamanan.  Seandainya saya pemograman socket di browser diperbolehkan, saya bisa menambahkan fasilitas lebih jauh seperti pemeriksaan <em>DNS spoofing</em> langsung dari browser.  Untuk mengakali keterbatasan ini, website pemeriksa <em>DNS spoofing</em> seperti <a href="https://dnsleaktest.com/">https://dnsleaktest.com/</a> membutuhkan sebuah <em>name server</em> khusus yang di-<em>hit</em> pada saat pengguna membuka situs tersebut.
				</p>
			</div>
		</div>
	</div>
</div>