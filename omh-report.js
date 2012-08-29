//ohmage("/user/read")

$(document).ready(function() {
	
	var opencpuserver = "http://dev1.opencpu.org"
	function ohmage(path, data, datafun){
		
		//input processing
		var data = data ? data : {};		
		var session = jQuery.parseJSON($.cookie("ohmage"))
		var serverurl = session ? session.serverurl : $("#serverurl").val();
		
		//This is only needed for safari. Chrome and FF will use the cookie:
		if(session && session.token) data.auth_token = session.token;
		
		//default parameter
		data.client = "omh-reporting"
			
		var myrequest = $.ajax({
			type: "POST",
			url : serverurl + path,
			data: data,
			dataType: "text",
			xhrFields: {
				withCredentials: true
			}
		}).done(function(rsptxt) {
			if(!rsptxt || rsptxt == ""){
				alert("Undefined error.")
				return false;
			}
			var response = jQuery.parseJSON(rsptxt);
			if(response.result == "success"){
				response.serverurl = serverurl;
				if(datafun) datafun(response)
			} else if(response.result == "failure") {
				processError(response.errors)
				return false;
			} else{
				alert("JSON response did not contain result attribute.")
			}
			
		}).error(function(){alert("Ohmage returned an undefined error.")});		
		
		return(myrequest)
	}
	
	//opencpu("stats/rnorm", {n:10})
	window.opencpu = function opencpu(path, data, datafun){
		var myrequest = $.ajax({
			type: "POST",
			timeout : 120 * 1000, //2min
			url : opencpuserver + "/R/pub/" + path + "/save",
			data: data
		}).done(function(rsptxt){
			if(datafun) {
				var response = jQuery.parseJSON(rsptxt);
				datafun(response);
			}
		}).error(function(xhr){
			alert(xhr.responseText)
		});		
		return(myrequest);		
	}
	
	function processError(errors){
		if(errors[0].code && errors[0].code == "0200"){
			logout();
			if(errors[0].text == "The token is unknown.") return;
			alert(errors[0].text)
		} else {
			alert(errors[0].text)
		}
	}
	
	function logout(){
		$.cookie("ohmage", null);
		$("#dashboard").hide();
		$("#logindiv").show();
		$("#targetgroup").removeClass("success");
		$("#targetgroup").removeClass("error");
		$("#downloadbutton").addClass("disabled").attr("disabled", "disabled")
		$("#pdflink").attr("href", "");
		$("#pdflink img").hide();
		$(".brand").text("")
	}

	function trylogin() {
		
		$.cookie("ohmage", null)
		$("#loginbutton").addClass("disabled").attr("disabled", "disabled")
		var user = $("#user").val();
		var password = $("#password").val();

		ohmage("/user/auth_token", { user: user, password: password},
			function(response, xhr){
				$.cookie("ohmage", JSON.stringify({user:user, serverurl:response.serverurl, token:response.token}));
				$(".brand").text("[ " + user + " ]")
				postLogin()
			}
		).complete(function(){
			$("#loginbutton").removeClass("disabled").attr("disabled", null)
		});
	}
	
	function populateUsers(){
		ohmage("/user/read", {}, function(result){
			$('#targetuser option').remove();
			$('#targetuser').append($('<option>', { disabled: "disabled", selected : "selected", value : "" }).text("Select target user..."));
			var namelist = [];
			for(name in result.data) {
				namelist.push(name);
			}
			for(i in namelist.sort()){
			     $('#targetuser').append($('<option>', { value : namelist[i] }).text(namelist[i])); 
			};
		});
	}
	
	function userCheckData(username){
		ohmage("/mobility/dates/read", { username : username }, function(result){
			n = 14;
			today = new Date();
			startdate = new Date(today.getFullYear(), today.getMonth(), today.getDate()-n); // create new increased date
			datadates = []
			for (datestring in result.data){
				split = result.data[datestring].split('-');
				mydate = new Date(split[0], split[1]-1, split[2]); 
				if(mydate > startdate) datadates.push(mydate)
			}
			$("#daycounter").text(datadates.length)
			if(datadates.length > 0){
				$("#targetgroup").addClass("success")
				$("#downloadbutton").removeClass("disabled").attr("disabled", null)
			} else {
				$("#targetgroup").addClass("error")
			}
		});		
	}
	
	function postLogin(){
		$("#logindiv").hide();
		$("#dashboard").show();	
		var session = jQuery.parseJSON($.cookie("ohmage"))
		$(".brand").text("["+session.user+"]")
		populateUsers();
	}
	
	function enquote(str){
		var y = str.replace(/"/g,'\\"');
		return '"' + y + '"'
	}
	
	function downloadReport(){
		var session = jQuery.parseJSON($.cookie("ohmage"));
		$("#downloadbutton").addClass("disabled").attr("disabled", "disabled");
		opencpu("dpu.mobility/painreport", {
			username : enquote($('#targetuser').val()),
			serverurl : enquote(session.serverurl),
			token : enquote(session.token)
		}, function(response){
			$("#pdflink").attr("href", opencpuserver + "/R/tmp/" + response.files["report.pdf"] + "/bin");
			$("#pdflink img").show();
		}).complete(function(){
			$("#downloadbutton").removeClass("disabled").attr("disabled", null);
		});
	}

	//DOM event handlers
	$("#loginbutton").click(function(event) {
		event.preventDefault();
		trylogin();
		return false;
	});
	
	$("#targetuser").change(function(){
		userCheckData($(this).val())
	}).click(function(){
		$("#targetgroup").removeClass("success");
		$("#targetgroup").removeClass("error");
		$("#downloadbutton").addClass("disabled").attr("disabled", "disabled");
		$("#pdflink").attr("href", "");
		$("#pdflink img").hide();		
	})
	
	$("#downloadbutton").click(function(e){
		e.preventDefault();
		downloadReport();
	});
	
	$('.spinnerdiv')
    .hide()  // hide it initially
    .ajaxStart(function() {
        $(this).show();
    })
    .ajaxStop(function() {
        $(this).hide();
    });
	
	$("#signout").click(function(){
		logout();
	})
	
	//dc.barChart("#date-chart").width(1000).height(250)
		
	//Onload Initiator	
	if($.cookie("ohmage")){
		postLogin()
	}
});