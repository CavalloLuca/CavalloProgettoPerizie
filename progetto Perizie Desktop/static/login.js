"use strict"

$(document).ready(function () {
    let _username = $("#username");
    let _password = $("#password");
    let _password1 = $("#password1");
    let _password2 = $("#password2");
    let _loginForm = $("#loginForm");
    let _changePwd = $("#changePwd");
    let btn;

    _loginForm.show();
    _changePwd.hide();
    btn="btnLogin"

    $("#btnLogin").on("click", controllaLogin);
    $("#btnInvia").on("click", cambioPassword);

    $(document).on('keydown', function (event) {
        if (event.keyCode == 13){
            if(btn=="btnLogin")
                controllaLogin();
            else if(btn=="btnInvia")
                cambioPassword();
        } 
    });


    function controllaLogin() {
        if (_username.val() != "" && _password.val() != "") {
            let request = inviaRichiesta("POST", "/api/checkUserPwd", {
                "username": _username.val(),
                "password": _password.val()
            });
            request.fail(function (jqXHR, test_status, str_error) {
                _username.val("");
                _password.val("");
                $(".modal-body .container-fluid").children("p").html("");
                $("<p>").html("Username o password errati.\nRiprova o controlla di avere i diritti di accesso!").addClass("erroreLogin").appendTo(".modal-body .container-fluid");
            });
            request.done(function (data) {
                if (data["cambioPwd"]) {
                    _loginForm.hide();
                    btn="btnInvia";
                    _changePwd.show(500);
                    $(".modal-body .container-fluid").children("p").html("");
                    $(".modal-header p").html("Benvenuto " + _username.val() + "!\nCambia la tua password!");
                }
                else{
                    let request = inviaRichiesta("POST", "/api/login", {
                        "username": _username.val(),
                        "password": _password.val(),
                        "desktop": true
                    });
                    request.fail(function (jqXHR, test_status, str_error) {
                        _username.val("");
                        _password.val("");
                        $(".modal-body .container-fluid").children("p").html("");
                        $("<p>").html("Username o password errati.\nRiprova o controlla di avere i diritti di accesso!").addClass("erroreLogin").appendTo(".modal-body .container-fluid");
                    });
                    request.done(function (data) {
                        window.location.href = "index.html";
                    });
                }
            });
        }
        else {
            for (let input of $(".input-group")) {
                $(".modal-body .container-fluid").children("p").html("");
                if ($(input).val() == "")
                    $("<p>").html("Inserire tutti i campi!").addClass("erroreLogin").appendTo(".modal-body .container-fluid");
            }
        }
    }

    function cambioPassword() {
        if (_password1.val() != "" && _password1.val() == _password2.val()) {
            let request = inviaRichiesta("POST", "/api/changePwd", {
                "username": _username.val(),
                "password": _password1.val()
            });
            request.fail(function (jqXHR, test_status, str_error) {
                _password1.val("");
                _password2.val("");
                $(".modal-body .container-fluid").children("p").html("");
            });
            request.done(function (data) {
                $(".modal-body .container-fluid").children("p").html("");
                _changePwd.hide();
                _password.val("");
                _loginForm.show(500);
                btn="btnLogin";
            });
        }
        else if (_password1.val() == "" || _password2.val() == "") {
            $(".modal-body .container-fluid").children("p").html("");
            _password1.val("");
            _password2.val("");
            $("<p>").html("Attenzione! Inserire entrambe le password!").addClass("erroreLogin").appendTo(".modal-body .container-fluid");
        }
        else if(_password1.val() != _password2.val()){
            $(".modal-body .container-fluid").children("p").html("");
            _password1.val("");
            _password2.val("");
            $("<p>").html("Attenzione! Le password sono diverse tra di loro.").addClass("erroreLogin").appendTo(".modal-body .container-fluid");
        }
    }

});