"use strict"

$(document).ready(function () {
    let btnUtente = $("#btnNewUser");
    let btnInserisci = $("#btnInserisci");
    let btnViewMap = $("#btnViewMap");
    let btnView = $("#btnView");
    let lastUserMail = "";
    let lastUserPwd = "";
    let btnLogout = $("#logout");
    let precInfoW;

    $("#utenti").hide();
    $("#wrapper").hide();

    visualizzaUtenti();
    btnInserisci.attr("disabled", "true");
    $("#btnPercorso").attr("disabled", "true");

    btnUtente.on("click", utenti);
    btnInserisci.on("click", addUser);
    btnViewMap.on("click", mappa);
    btnView.on("click", mappa);
    btnLogout.on("click", logout);

    $("#cognome").on("keyup", function () {
        if ($(this).val() == "" || $("#nome").val() == "" || $("#mail").val() == "")
            btnInserisci.attr("disabled", "true");
        else
            btnInserisci.removeAttr("disabled");
    });

    $("#nome").on("keyup", function () {
        if ($("#cognome").val() == "" || $(this).val() == "" || $("#mail").val() == "")
            btnInserisci.attr("disabled", "true");
        else
            btnInserisci.removeAttr("disabled");
    });

    $("#mail").on("keyup", function () {
        if ($("#cognome").val() == "" || $(this).val() == "" || $("#nome").val() == "" || !checkEmail($("#mail").val()))
            btnInserisci.attr("disabled", "true");
        else
            btnInserisci.removeAttr("disabled");
    });


    function utenti() {
        $("#wrapper").hide();
        $("#utenti").show();
        $(this).attr("disabled", "true");
        btnViewMap.removeAttr("disabled");
    }

    function addUser() {
        $("#pwd").html("");
        let admin = true;

        if ($("#ut").prop("checked"))
            admin = false;

        let request = inviaRichiesta("POST", "/api/addUser", {
            "nominativo": $("#cognome").val() + " " + $("#nome").val(),
            "mail": $("#mail").val(),
            "admin": admin
        });
        request.fail(function (jqXHR, test_status, str_error) {
            //errore(jqXHR, test_status, str_error);
            $("#cognome").val("");
            $("#nome").val("");
            $("#mail").val("");
            let close = $("<button>").prop("type", "button").prop("id", "btnClose").addClass("close").appendTo($("#pwd"));
            $("<span>").prop("aria-hidden", "true").html("&times;").css("color", "red").on("click", closeSez).appendTo(close);
            $("<h4>").html("Nominativo e/o indirizzo mail già presenti all'interno del database.").css({ "color": "red", "font-weight": "bold" }).appendTo($("#pwd"));
            btnInserisci.attr("disabled", "true");
        });
        request.done(function (data) {
            //console.log(data);
            lastUserMail = $("#mail").val();
            lastUserPwd = data["pwd"];
            $("#cognome").val("");
            $("#nome").val("");
            $("#mail").val("");
            let close = $("<button>").prop("type", "button").prop("id", "btnClose").addClass("close").appendTo($("#pwd"));
            $("<span>").prop("aria-hidden", "true").html("&times;").css("color", "red").on("click", closeSez).appendTo(close);
            $("<h4>").html("La password di " + data["nom"] + " è <b>" + data["pwd"] + "</b>").appendTo($("#pwd"));
            $("<button>").prop("type", "button").addClass("btn btn-secondary").html("Invia password tramite mail").on("click", inviaPasswordMail).appendTo($("#pwd"));
            btnInserisci.attr("disabled", "true");
            visualizzaUtenti();
        });
    }

    function closeSez() {
        $(this).parent().parent().html("");
    }

    function inviaPasswordMail() {
        let request = inviaRichiesta("POST", "/api/sendMail", { "mail": lastUserMail, "password": lastUserPwd });
        request.fail(function (jqXHR, test_status, str_error) {
            errore(jqXHR, test_status, str_error)
        });
        request.done(function (data) {
            $("#pwd").html("");
        });
    }

    function visualizzaUtenti() {
        $("#viewAllUsers").html("");
        $("<h3>").html("Elenco di tutti i dipendenti").appendTo($("#viewAllUsers"));
        let ul = $("<ul>").appendTo($("#viewAllUsers"));

        let request = inviaRichiesta("POST", "/api/viewUsers");
        request.fail(function (jqXHR, test_status, str_error) {
            errore(jqXHR, test_status, str_error)
        });
        request.done(function (data) {
            //console.log(data);
            for (let i = 0; i < data.length; i++) {
                if (data[i]["admin"] == true)
                    $("<li>").html(data[i]["nominativo"] + ": AMMINISTRATORE").appendTo(ul);
                else
                    $("<li>").html(data[i]["nominativo"] + ": UTENTE").appendTo(ul);
            }
        });
    }

    function mappa() {
        $("#utenti").hide();
        $("#wrapper").show();
        $("#dettagliFoto").html("");
        btnViewMap.attr("disabled", "true");
        $("#btnPercorso").attr("disabled", "true");
        btnUtente.removeAttr("disabled");

        if ($("#citta").val() == "")
            alert("Inserire un luogo valido.");
        else {
            let geocoder = new google.maps.Geocoder();
            geocoder.geocode({
                "address": $("#citta").val()
            }, function (results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    //console.log(results);
                    disegnaMappa(results[0]);
                }
                else {
                    alert("Posizione non valida");
                }
            });
        }
    }

    function disegnaMappa(coordinate) {
        let posizione = coordinate.geometry.location;
        let opzioni = {
            "center": posizione,
            "zoom": 10,
            "mapTypeId": google.maps.MapTypeId.ROADMAP
        };
        let mappa = new google.maps.Map(window.document.getElementById("mappafoto"), opzioni);

        let request = inviaRichiesta("POST", "/api/allFoto");
        request.fail(function (jqXHR, test_status, str_error) {
            errore(jqXHR, test_status, str_error)
        });
        request.done(function (data) {
            //console.log(data);
            let marker;

            for (let i = 0; i < data.length; i++) {
                marker = new google.maps.Marker({
                    "map": mappa,
                    "position": new google.maps.LatLng(data[i]["lat"], data[i]["lng"]),
                    "title": data[i]["descr"],
                    "animation": google.maps.Animation.DROP,
                    "zIndex": 3,
                    "draggable": false
                });
                let info = "<div>" +
                    "<h4>" + data[i]["utente"] + "</h4>" +
                    "<p>Descrizione: " + data[i]["descr"] + "</p>" +
                    "<p>Coordinate: " + new google.maps.LatLng(data[i]["lat"], data[i]["lng"]) + "</p>" +
                    "<p>Data: " + data[i]["todayDay"] + "</p>" +
                    "<p>Ora: " + data[i]["nowTime"] + "</p>" +
                    "</div>";
                let infoWindow = new google.maps.InfoWindow({
                    content: info
                });
                marker.addListener("click", function () {
                    if (precInfoW)
                        precInfoW.close();

                    precInfoW = infoWindow;

                    infoWindow.open(mappa, this);
                    dettagliFoto(data[i]);
                    $("#btnPercorso").removeAttr("disabled");
                });
                google.maps.event.addListener(infoWindow, 'closeclick', function () {
                    precInfoW.close();
                    $("#dettagliFoto").html("");
                    $("#btnPercorso").attr("disabled", "true");
                });
            }
        });
    }

    function dettagliFoto(data) {
        //console.log(data);
        $("#btnPercorso").on("click", function () {
            $(this).attr("disabled", "true");
            visualizzaPercorso(data);
        });
        let detFoto = $("#dettagliFoto");
        detFoto.html("");

        $("<img>").prop("src", data["img"]).css("width", "200px").appendTo(detFoto);
        $("<br><br>").appendTo(detFoto);
        $("<p>").html("Inserire una descrizione personale (facoltativo)").appendTo(detFoto);
        let txt = $("<input>").prop("id", "txtDescr").prop("type", "textbox").prop("value", data["descPersAmm"]).appendTo(detFoto);
        $("<br><br>").appendTo(detFoto);
        $("<button>").html("Aggiungi modifica").addClass("btn btn-secondary").appendTo(detFoto).on("click", function () {
            aggiungiDescrizione(data);
        });
    }

    function aggiungiDescrizione(data) {
        let request = inviaRichiesta("POST", "/api/addDescr", {
            "descr": $("#txtDescr").val(),
            "id": data["_id"]
        });
        request.fail(function (jqXHR, test_status, str_error) {
            errore(jqXHR, test_status, str_error)
        });
        request.done(function (data) {
            //console.log(data);
            if (data["ris"] == "ok") {
                $("#dettagliFoto").html("");
                mappa();
                $("#btnPercorso").attr("disabled", "true");
            }
        });
    }

    function visualizzaPercorso(data) {
        $("#dettagliFoto").html("");
        //console.log(data);
        let options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }

        navigator.geolocation.getCurrentPosition(onSuccess, onError, options);

        function onSuccess(position) {
            //console.log(position);
            //console.log(data);

            let p1 = position.coords.latitude;
            let p2 = position.coords.longitude;

            let geocoder = new google.maps.Geocoder();
            geocoder.geocode({
                "location": new google.maps.LatLng(p1, p2)
            }, function (resultsP, statusP) {
                if (statusP == google.maps.GeocoderStatus.OK) {
                    geocoder.geocode({
                        "location": new google.maps.LatLng(data["lat"], data["lng"])
                    }, function (resultsA, statusA) {
                        if (statusA == google.maps.GeocoderStatus.OK) {
                            let coordP = resultsP[0]["geometry"]["location"];
                            let coordA = resultsA[0]["geometry"]["location"];
                            disegnaPercorso(coordP, coordA);
                        } else
                            alert("Posizione di arrivo non valida");
                    })
                } else
                    alert("Posizione di partenza non valida");
            });
        }

        function onError(err) {
            console.log("ERROR(" + err.code + "): " + err.message);
        }
    }

    function disegnaPercorso(coordP, coordA) {
        console.log(coordP + "\n" + coordA);
        let mapOptions = {
            "center": coordP,
            "zoom": 16,
            "mapTypeId": google.maps.MapTypeId.ROADMAP
        }
        let directionsService = new google.maps.DirectionsService();
        let directionsRenderer = new google.maps.DirectionsRenderer();

        let percorso = {
            "origin": coordP,
            "destination": coordA,
            "travelMode": google.maps.TravelMode.DRIVING
        }

        // calcola il percorso
        directionsService.route(percorso, function (routes, status) {
            if (status == google.maps.DirectionsStatus.OK) {
                let mapID = new google.maps.Map(window.document.getElementById("mappafoto"), mapOptions);

                // disegno del percorso
                directionsRenderer.setDirections(routes);
                directionsRenderer.setMap(mapID);
                $("#dettagliFoto").html("");
                directionsRenderer.setPanel(window.document.getElementById("dettagliFoto"));

                // distanza e tempo di percorrenza
                let distanza = routes.routes[0].legs[0].distance.text;
                let tempo = routes.routes[0].legs[0].duration.text;
                $("#dettagliFoto").html("Distanza: <b>" + distanza + "</b><br>Tempo di percorrenza: <b>" + tempo + "<b>");
            }

        });
    }

    function validaEmail(email) {
        var regexp = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;
        return regexp.test(email);
    }

    function checkEmail(email) {
        if (validaEmail(email))
            return true;
        else
            return false;
    }

    function logout() {
        let request = inviaRichiesta("POST", "/api/logout");
        request.fail(errore);
        request.done(function (data) {
            window.location.href = "login.html";
        });
    }

});