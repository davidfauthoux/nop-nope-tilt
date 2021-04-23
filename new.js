"use strict"

$(function() {
	var location = Server.location();

	var layout = new Layout();
	layout.fit(false);

	//var emailInput = $("<input>").attr("placeholder", "Email address");
	var idInput = $("<input>").attr("placeholder", "Login");
	//var passwordInput = $("<input>").attr("type", "password").attr("placeholder", "Password");
	var button = $("<div>").addClass("button").text("Create").click(function() {
		/*
		var email = emailInput.val();
		if (email === "") {
			return;
		}
		*/
		var id = idInput.val();
		if (id === "") {
			id = undefined;
		}
		/*
		var password = passwordInput.val();
		if (password === "") {
			password = undefined;
		}
		*/

		button.addClass("disabled");

		var idHeap = new Heap(location.platform + "/" + id);
		console.log(id);
		EncryptingServer.newUser(idHeap, new Heap(), new Heap("david.fauthoux@gmail.com")).res(function() {
			button.removeClass("disabled");

			//TODO ok
			var url = location.url + "/" + idHeap.get();
			console.log(url);
			//window.location.href = url;
		}).err(function(e) {
			button.removeClass("disabled");
			//TODO
			console.log("ERROR", e);
		}).run();
	});
	//layout.packed().layout().inside().$.append(emailInput);
	layout.packed().layout().inside().$.append(idInput);
	//layout.packed().layout().inside().$.append(passwordInput);
	layout.packed().layout().inside().$.append(button);
});