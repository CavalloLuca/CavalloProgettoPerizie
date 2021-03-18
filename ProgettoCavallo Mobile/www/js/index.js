"use strict";

$(document).ready(function () {
    document.addEventListener("deviceready", function () {
        let me;
        let img;
        let currentPos;
        let lat;
        let lng;
        let todayDay;
        let nowTime;
        let _sezFoto = $("#sezFoto");
        let _img;
        let _singolFoto;
        let _delFoto;
        let _descr;
        let _btnInvia = $("#btnInvia");
        let btnLogout = $("#logout");
        let view = false;
        let _divImg;
        let _divP;
        let _divBtn;

        $("table thead tr th").on("click", visualizzaFoto);
        $("table tbody").hide();

        if ($(_sezFoto).children("tr").length == 0) {
            _btnInvia.hide();
            $("table thead tr th").hide();
        }

        btnLogout.on("click", logout);

        let request = inviaRichiesta("POST", "https://cavalloluca-progettoperizie.herokuapp.com/api/me");
        request.fail(function (jqXHR, test_status, str_error) {
            errore(jqXHR, test_status, str_error);
            alert("errore");
        });
        request.done(function (data) {
            me = data.myCode;
        });

        let wrapper = $("#wrapper"),
            cameraOptions = {
                "quality": 50,
                "correctOrientation": true
            };

        $("#btnScatta").on("click", function () {
            cameraOptions.sourceType = Camera.PictureSourceType.CAMERA;
            cameraOptions.destinationType = Camera.DestinationType.DATA_URL;
            navigator.camera.getPicture(success, error, cameraOptions);
        });

        _btnInvia.on("click", function () {
            for (let foto of $(_sezFoto).children("tr")) {
                let request = inviaRichiesta("POST", "https://cavalloluca-progettoperizie.herokuapp.com/api/caricaFoto", {
                    "user": me,
                    "img": $(foto).children("td").children("img").prop("img"),
                    "lat": $(foto).children("td").children("img").prop("lat").toString(),
                    "lng": $(foto).children("td").children("img").prop("lng").toString(),
                    "nowTime": $(foto).children("td").children("img").prop("nowTime"),
                    "todayDay": $(foto).children("td").children("img").prop("todayDay"),
                    "descr": $(foto).children("td").children("img").prop("descr")
                });
                request.fail(function (jqXHR, test_status, str_error) {
                    errore(jqXHR, test_status, str_error)
                });
                request.done(function (data) {
                    _sezFoto.html("");
                    _sezFoto.hide();
                    _btnInvia.hide();
                    $("table thead tr th").hide();
                    view = false;
                });
            }
        });

        function logout() {
            let request = inviaRichiesta("POST", "https://cavalloluca-progettoperizie.herokuapp.com/api/logout");
            request.fail(errore);
            request.done(function (data) {
                window.location.href = "login/login.html";
            });
        }



        function success(image) {
            $("table thead tr th").show();
            _singolFoto = $("<tr>").appendTo(_sezFoto).addClass("prova");

            _divImg = $("<td>").prop("colspan", "1").appendTo(_singolFoto);
            _divP = $("<td>").css({"text-align":"left"}).prop("colspan", "5").appendTo(_singolFoto);
            _divBtn = $("<td>").prop("colspan", "1").appendTo(_singolFoto);

            _img = $("<img>").css({ "width": 90 });
            if (cameraOptions.destinationType == Camera.DestinationType.DATA_URL)
                _img.prop("src", "data:image/jpeg;base64," + image);
            else
                _img.prop("src", image);
            _img.appendTo(_divImg);

            _descr = $("<p>").appendTo(_divP);
            _delFoto = $("<button>").html("X").addClass("btn btn-outline-danger").on("click", deleteFoto).appendTo(_divBtn);
            //let svg=$("<svg>").prop("xmlns","http://www.w3.org/2000/svg").prop("width","16").prop("height","16")
            //.prop("fill","currentColor").prop("viewBox","0 0 16 16").addClass("bi bi-trash-fill").appendTo(_delFoto);
            //$("<path>").prop("d","M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z").appendTo(svg);
            //$("<i>").addClass("bi bi-trash-fill").appendTo(_divBtn);


            _img.on("click", viewFeat);
            _descr.on("click", viewDescr);

            img = "data:image/jpeg;base64," + image;
            let date = new Date();
            nowTime = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds(); //ora:minuti:secondi attuali
            todayDay = date.getDate() + "/" + (parseInt(date.getMonth()) + 1) + "/" + date.getFullYear(); //giorno/mese/anno attuale

            _img.prop("img", img).prop("nowTime", nowTime).prop("todayDay", todayDay);

            let options = {
                enableHighAccuracy: true,
                timeout: 500,
                maximumAge: 0
            };

            _sezFoto.show(500);
            _btnInvia.show(500);

            addDescr();

            //navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
            navigator.geolocation.watchPosition(onSuccess, onError, options);

            function onSuccess(position) {
                currentPos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                _img.prop("lat", position.coords.latitude);
                _img.prop("lng", position.coords.longitude);
                _img.prop("currentPos", currentPos);
            }

            function onError(err) {
                console.log("ERROR(" + err.code + "): " + err.message);
            }
        }

        function viewDescr() {
            _descr = $(this);
            _img = _descr.parent().siblings().eq(0).children("img");
            navigator.notification.prompt(
                "Note allegate alla foto",
                onPrompt,
                "Descrizione",
                ["Ok", "Nessuna modifica"],
                _img.prop("descr")
            );
        }

        function addDescr() {
            navigator.notification.prompt(
                "Inserire una descrizione alla fotografia",
                onPrompt,
                "Descrizione",
                ["Ok", "Nessuna descrizione"],
                ""
            );
        }

        function viewFeat() {
            _img = $(this);
            navigator.notification.prompt(
                "Data: " + _img.prop("todayDay") +
                "\nOra: " + _img.prop("nowTime") +
                "\nCoordinate geografiche: " + _img.prop("currentPos"),
                onPrompt1,
                "Visualizzazzione/modifica dati foto",
                ["Ok", "Nessuna modifica"],
                _img.prop("descr")
            );
        }

        function deleteFoto() {
            _delFoto = $(this);
            navigator.notification.confirm(
                "Sicuro di voler eliminare questa foto?",
                onConfirm,
                "Elimina",
                ["Si", "No"]
            );
        }

        function onPrompt(results) {
            if (results.buttonIndex == 1) {
                _descr.html(results.input1);
                _img.prop("descr", results.input1);
            }
        }

        function onPrompt1(results) {
            if (results.buttonIndex == 1) {
                _img.prop("descr", results.input1);
                _img.parent().next().children("p").html(results.input1);
            }
        }

        function onConfirm(buttonIndex) {
            if (buttonIndex == 1)
                _delFoto.parent().parent().remove();

            if ($(_sezFoto).children("tr").length == 0) {
                _btnInvia.hide();
                $("table thead tr th").hide();
            }
        }

        function error(err) {
            if (err.code) {
                alert(err.code + " - " + err.message);
            }
        }

        function visualizzaFoto() {
            if (view) {
                $("table tbody").show(500);
                $("table thead tr th").html("Nascondi foto");
                _btnInvia.show(500);
                view = false;
            }
            else {
                $("table tbody").hide(500);
                $("table thead tr th").html("Visualizza foto");
                _btnInvia.hide(500);
                view = true;
            }

        }

    })
});