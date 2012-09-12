//ohmage("/user/read")

$(document).ready(function() {
	
	//globalz
	var n = 14;
	var today = new Date();
	var startdate = new Date(today.getFullYear(), today.getMonth(), today.getDate()-n);
	
	//we match the protocol (http vs https) with the current server. IE requires that for CORS.
	//public.opencpu.org should support either.
	var opencpuserver = window.location.protocol + "//public.opencpu.org"
	
	//crossfilter data
	var mobility;

	//crossfilter dimensions
	var mobilityByMode;
	var mobilitySedentary;
	var mobilityByDate;
	var mobilityByDuration;
	
	var mobilityAll;
	var mobilityWalkTime;
	var mobilityModeGroup;
	
	makeDateChart([]);		
	
	//ohmage calling function
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
		$(".databutton").addClass("disabled").attr("disabled", "disabled")
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
	
	function userCheckData(){
		
		if($("#targetuser").val() == "") return;
		
		$("#daycounter").text("x");
		$("#n").text("n");
		
		var username = $("#targetuser").val();
		makeDateChart([]);
		ohmage("/mobility/dates/read", { username : username, start_date: asDate(startdate), end_date: asDate(today) }, function(result){
			datadates = []
			for (datestring in result.data){
				var mydate = fromDate(result.data[datestring]);
				if(mydate > startdate) datadates.push(mydate)
			}
			$("#daycounter").text(datadates.length);
			$("#n").text(n);
			if(datadates.length > 0){
				$("#targetgroup").addClass("success")
				$(".databutton").removeClass("disabled").attr("disabled", null)
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
	
	function loadData(){
		// username
		var username = $("#targetuser").val();
		var startdate = new Date(today.getFullYear(), today.getMonth(), today.getDate()-n); // create new increased date	
		$(".databutton").addClass("disabled").attr("disabled", "disabled");
		
		ohmage("/mobility/aggregate/read", {duration: 1, username : username, start_date: asDate(startdate), end_date: asDate(today)}, function(result){
			if(!result.data || result.data.length == 0) return false;
			var aggregatedata = [];
			for(var i = 0; i < result.data.length; i++){
				var modes = result.data[i].data;
				for(var j = 0; j < modes.length; j++){
					//if(modes[j].mode == "still") continue;
					aggregatedata.push({
						date : fromDate(result.data[i].timestamp),
						mode : modes[j].mode,
						duration : Math.round(modes[j].duration / (60*1000)),
						sedentary : (modes[j].mode != "walk" && modes[j].mode != "run")
					})
				}
			}
			
			makeDateChart(aggregatedata);
		}).complete(function(){
			$(".databutton").removeClass("disabled").attr("disabled", null);
		});	
	}
	
	function downloadReport(){
		var session = jQuery.parseJSON($.cookie("ohmage"));
		var fullurl = session.serverurl;
		
		//in case the ohmage server is the current host, we need to get the full url from the window.location
		if(fullurl == "/app"){
			fullurl = window.location.protocol + "//" + window.location.host + fullurl;
		}
		
		$(".databutton").addClass("disabled").attr("disabled", "disabled");
		opencpu("dpu.mobility/painreport", {
			username : enquote($('#targetuser').val()),
			serverurl : enquote(fullurl),
			token : enquote(session.token),
			days : n
		}, function(response){
			$("#pdflink").attr("href", opencpuserver + "/R/tmp/" + response.files["report.pdf"] + "/bin");
			$("#pdflink img").show();
		}).complete(function(){
			$(".databutton").removeClass("disabled").attr("disabled", null);
		});
	}
	
	function makeDateChart(data){
		
		$("#date-chart").empty();
		$("#move-chart").empty();
		
		mobility = crossfilter(data);
		mobilityAll = mobility.groupAll();
		
		mobilityByMode = mobility.dimension(function(d) { return d.mode});
		mobilitySedentary = mobility.dimension(function(d) { return d.sedentary });
		mobilityByDate = mobility.dimension(function(d) {return d.date});
		mobilityByDuration = mobility.dimension(function(d) {return d.duration});
		
		mobilityWalkTime = mobilityByDate.group().reduceSum(function(d) { return d.mode == "walk" ? d.duration : 0 });
		mobilityRunTime = mobilityByDate.group().reduceSum(function(d) { return d.mode == "run" ? d.duration : 0 });
		mobilityDriveTime = mobilityByDate.group().reduceSum(function(d) { return d.mode == "drive" ? d.duration : 0 });	
		
		mobilityModeGroup = mobilityByMode.group().reduceSum(function(d) { return d.mode == "still" ? 0 : d.duration });		

		dc.barChart("#date-chart")
			.width(980) // (optional) define chart width, :default = 200
			.height(200) // (optional) define chart height, :default = 200
			.margins({top: 10, right: 50, bottom: 30, left: 40})
			.dimension(mobilityByDate) // set dimension
			.group(mobilityWalkTime) // set group
			.stack(mobilityDriveTime)
			.stack(mobilityRunTime)
			.elasticY(true)
			.yAxisPadding(20)
			.centerBar(false)
			.elasticX(false)
			.xAxisPadding(1)
			.renderHorizontalGridLines(true)
			.renderVerticalGridLines(false)			
			.x(d3.time.scale().domain([startdate, today]))
			.round(d3.time.day.round)
			.xUnits(d3.time.days)
	    
		dc.pieChart("#move-chart")
		    .width(180) 
		    .height(180) 
		    .colors(["#000000", '#fb8072', '#b3de69', '#80b1d3'])
		    //.colorAccessor(function(d, i){return d.value;})
		    .radius(80) // define pie radius
		    .innerRadius(10)
		    .dimension(mobilityByMode) // set dimension
		    .group(mobilityModeGroup) // set group
		    .renderLabel(true) 
		    .title(function(d) { return d.data.key + ": " + d.data.value + " minutes" })
	    
	    dc.renderAll();
		dc.redrawAll();
	}
	
	function asDate(mydate){
		return mydate.toISOString().substring(0,10);
	}

	function fromDate(mystring){
		var split = mystring.split('-');
		return new Date(split[0], split[1]-1, split[2]); 		
	}
	
	//DOM event handlers
	$("#loginbutton").click(function(event) {
		event.preventDefault();
		trylogin();
		return false;
	});
	
	$("#targetuser,#dayselector").change(function(){
		n = $("#dayselector").val();
		startdate = new Date(today.getFullYear(), today.getMonth(), today.getDate()-n);		
		userCheckData();
	}).click(function(){
		makeDateChart([]);
		$("#targetgroup").removeClass("success");
		$("#targetgroup").removeClass("error");
		$(".databutton").addClass("disabled").attr("disabled", "disabled");
		$("#pdflink").attr("href", "");
		$("#pdflink img").hide();	
		
	})
	
	$("#downloadbutton").click(function(e){
		e.preventDefault();
		downloadReport();
	});
	
	$("#loaddatabutton").click(function(e){
		e.preventDefault();
		loadData();
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
	
	//Onload Initiator	
	if($.cookie("ohmage")){
		postLogin();
	} 
	
	if(window.location.hostname == "openmhealth.github.com" || window.location.hostname == "openmhealth.org" || window.location.hostname == "www.openmhealth.org"){
		//in this case the current server is NOT an ohmage server and we change the default to the second option
		$("#serverurl").val($("#serverurl option")[1].text);
	}

});