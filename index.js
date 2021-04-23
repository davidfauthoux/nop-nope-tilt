"use strict"

$(function() {
	var location = Server.location();

	var windowUrlParameters = DomUtils.windowUrlParameters();

	var now = function() {
		return new Date().getTime();
	};

	var ago = function(timestamp){
		var delta = (now() - timestamp) / 1000;
	
		var ps, pm, ph, pd, min, hou, sec, days;
	
		if (delta < 10) {
			return "Just now";
		}
	
		if (delta < 60) {
			return "Less than a minute ago";
		}
	
		if (delta < 120) {
			return "A minute ago";
		}
	
		if (delta < 3600) {
			min = Math.floor(delta / 60);
			sec = Math.floor(delta - (min * 60));
			pm = (min > 1) ? "s": "";
			ps = (sec > 1) ? "s": "";
			// return min + " minute" + pm + " " + sec + " second" + ps + " ago";
			return min + " minute" + pm + " ago";
		}
	
		if (delta < 86400) {
			hou = Math.floor(delta / 3600);
			min = Math.floor((delta - (hou * 3600)) / 60);
			ph = (hou > 1) ? "s": "";
			pm = (min > 1) ? "s": "";
			// return hou + " hour" + ph + " " + min + " minute" + pm + " ago";
			return hou + " hour" + ph + " ago";
		} 
	
		days = Math.floor(delta / 86400);
		hou =  Math.floor((delta - (days * 86400)) / 60 / 60);
		pd = (days > 1) ? "s": "";
		ph = (hou > 1) ? "s": "";
		// return days + " day" + pd + " " + hou + " hour" + ph + " ago";
		return days + " day" + pd + " ago";
	}

	var layout = new Layout();
	layout.fit(false);

	if (windowUrlParameters["clear"] !== undefined) {
		EncryptingServer.clearUser(new Heap(location.id))
			.res(function() {
				var url = location.url + "/" + location.id;
				console.log(url);
				window.location.href = url;
			}).run();
		return;
	}
	
	var recover = windowUrlParameters["recover"];
	var userHeap = new Heap();
	if (recover !== undefined) {
		recover = recover[0];

		sequence_(
			EncryptingServer.validate(new Heap(location.id), new Heap(recover), new Heap(undefined), userHeap),
			EncryptingServer.loadUser(new Heap(location.id), passwordHeap, userHeap, new Heap(recover))
		).res(function() {
			var url = location.url + "/" + location.id;
			console.log(url);
			window.location.href = url;
		}).run();
		return;
	}
	
	var passwordHeap = new Heap();
	sequence_(
		EncryptingServer.loadUser(new Heap(location.id), passwordHeap, userHeap),
		do_(function() {
			var user = userHeap.get();

			var rowLayout = layout.vertical();
			var known = {};

			setInterval(function() {
				Utils.each(known, function(other) {
					if (other.timestamp.sent !== null) {
						other.sent.text("Sent: " + ago(other.timestamp.sent));
					}
					if (other.timestamp.received !== null) {
						other.received.text("Received: " + ago(other.timestamp.received));
					}
				});
			}, 10 * 1000);
		
			var server = new Server();
			//TODO server.longPolling = false;
			// server = new FilteringServer(server);
			var publicServer = server;
			server = new EncryptingServer(user, server);

			var createOther = function(fromId) {
				var other = known[fromId];
				if (other === undefined) {
					var userLayout = rowLayout.add();
					var nameDiv = $("<div>").text("...");
					var sendDiv = $("<div>").text("Love");
					var receivedDiv = $("<div>");
					var sentDiv = $("<div>");
					
					sendDiv.click(function() {
						var timestamp = now();
		
						sendDiv.addClass("disabled");
				
						sequence_(
							server.stack(new Heap({
								from: user.id,
								to: fromId,
								timestamp: timestamp
							})),
							server.stack(new Heap({
								sent: fromId,
								from: user.id,
								to: user.id,
								timestamp: timestamp
							}))).res(function() {
								// OK
								console.log("SENT");
								sendDiv.removeClass("disabled");
							}).err(function(e) {
								console.log("ERROR", e);
								sendDiv.removeClass("disabled");
							}).run();
					});
		
					var otherServer = new EncryptingServer(null, new Server("../../" + fromId));

					var otherEventHeap = new Heap();
					while_(true_())
						.do_(try_(
							sequence_(
								Server.fullHistory(otherServer, otherEventHeap),
								block_(function() {
									var r = otherEventHeap.get();
									if (r.action === "") {
										return;
									}
									console.log("***", fromId, r);
									if (r.name !== undefined) {
										nameDiv.text(r.name);
									}
								})))
							.catch_(function(e) {
								return sequence_(
									log_("ERR", e),
									sleep_(10));
							})).run();
		
					userLayout.$.append(nameDiv);
					userLayout.$.append(sendDiv);
					userLayout.$.append(receivedDiv);
					userLayout.$.append(sentDiv);
					other = {
						layout: rowLayout.add(),
						name: nameDiv,
						received: receivedDiv,
						sent: sentDiv,
						timestamp: {
							sent: null,
							received: null
						},
						server: otherServer
					};
					known[fromId] = other;
				}

				return other;
			};
		
			var handleEvent = function(r) {
				if (r.sent !== undefined) {
					var other = createOther(r.sent);
					if (r.timestamp !== undefined) {
						other.timestamp.sent = r.timestamp;
						other.sent.text("Sent: " + ago(other.timestamp.sent));
					}
				} else if (r.from !== undefined) {
					var other = createOther(r.from);
					if (r.timestamp !== undefined) {
						other.timestamp.received = r.timestamp;
						other.received.text("Received: " + ago(other.timestamp.received));
					}
				}
			};

			var eventHeap = new Heap();
			var listHeap = new Heap();
			var offsetHeap = new Heap();

			var oldEvents = [];

			return sequence_(
				parallel_(Registry.start(user)),
				server.list(new Heap("/registry"), listHeap),
				log_(listHeap),
				server.stack(new Heap({
					from: user.id,
					name: user.id
				})),
				while_(true_())
					.do_(try_(
						sequence_(
							Server.fullHistory(server, eventHeap),
							// sleep_(0.1),
							block_(function() {
								var r = eventHeap.get();
								console.log("EVENT", r);
								if (r.action === "") {
									var newKnown = windowUrlParameters["new"];
									if (newKnown !== undefined) {
										Utils.each(newKnown, function(n) {
											createOther(n);
										});
									}
								} else {
									handleEvent(r);
								}
							})))
						.catch_(function(e) {
							return sequence_(
								log_("ERR", e),
								sleep_(10));
						})));
		})).err(function(ee) {
			console.log("ERROR", ee);
			EncryptingServer.recover(new Heap(location.id)).run();
		}).run();
});