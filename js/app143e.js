/*
		   ______________________________________
  ________|                                      |_______
  \       |                                      |      /
   \      |        Developed by Legacy           |     /
   /      |______________________________________|     \
  /__________)                                (_________\

*/
"use strict";

var USER = null;
var SOCKET = null;

var RECAPTCHA = null;

var BALANCE = 0;

var offers_currencyValues = {
	'BTC': 0,
	'ETH': 0,
	'LTC': 0,
	'BCH': 0,
	'PAYPAL': 0.32
}

//AUDIO
var audio_roulette_rolling = new Audio(ROOT + 'template/audio/roulette_rolling.wav');
var audio_roulette_end = new Audio(ROOT + 'template/audio/roulette_end.wav');
var audio_jackpot_rolling = new Audio(ROOT + 'template/audio/jackpot_rolling.wav');
var audio_unbox_rolling = new Audio(ROOT + 'template/audio/unbox_rolling.wav');

audio_roulette_rolling.volume = 0.75;
audio_roulette_end.volume = 0.75;
audio_jackpot_rolling.volume = 0.75;
audio_unbox_rolling.volume = 0.75;

//PROFILE SETTINGS

var profile_settings = {
	'sounds': {
		'type': 'cookie',
		'value': '1'
	},
	'channel': {
		'type': 'cookie',
		'value': 'en'
	},
	'chat': {
		'type': 'cookie',
		'value': '1'
	},
	'anonymous': {
		'type': 'save',
		'value': '0'
	},
	'private': {
		'type': 'save',
		'value': '0'
	},
	'game': {
		'type': 'cookie',
		'value': 'roulette'
	},
};

function play_sound(sound) {
	sound.load();
	var play_promise = sound.play();

	if (play_promise !== undefined) {
		play_promise.then(function () {

		}).catch(function (err) {
			sound.pause();
		});
	}
}

function profile_settingsChange(setting, value) {
	if (profile_settings[setting] === undefined) return;

	profile_settings[setting].value = value;

	profile_settingsSave();
	profile_settingsAssign(setting, value);
}

function profile_settingsLoad() {
	var settings = JSON.parse(getCookie('settings'));

	if (!settings) return profile_settingsSave();

	var props1 = Object.keys(settings);
	props1.forEach(function (item) {
		if (profile_settings[item] !== undefined) {
			profile_settings[item].value = settings[item];
		}
	});

	var new_settings = false;

	var props2 = Object.keys(profile_settings);
	props2.forEach(function (item) {
		profile_settingsAssign(item, profile_settings[item].value);

		if (settings[item] === undefined && profile_settings[item].type == 'cookie') new_settings = true;
	});

	if (new_settings) return profile_settingsSave();
}

function profile_settingsAssign(setting, value) {
	if (setting == 'sounds' || setting == 'anonymous' || setting == 'private') $('.change-setting[data-setting="' + setting + '"]').prop('checked', (value == '1'));
	if (setting == 'game') {
		$('.change-setting[data-setting="' + setting + '"]').val(value);

		var $field = $('.change-setting[data-setting="' + setting + '"]').parent().parent().parent();
		changeDropdownFieldElement($field);

		$('#favorite_game .main-game').addClass('hidden');
		$('#favorite_game .main-game[data-game="' + value + '"]').removeClass('hidden');
	}

	switch (setting) {
		case 'sounds':
			$('#profile_setting_sounds').prop('checked', (value == '1'));

			audio_roulette_rolling.volume = (value == '1') ? 0.75 : 0;
			audio_roulette_end.volume = (value == '1') ? 0.75 : 0;
			audio_jackpot_rolling.volume = (value == '1') ? 0.75 : 0;
			audio_unbox_rolling.volume = (value == '1') ? 0.75 : 0;

			break;

		case 'channel':
			$('.flag').removeClass('active');
			$('.flag[data-channel=' + value + ']').addClass('active');
			$('#chat_message').attr('placeholder', 'Say something');

			break;

		case 'chat':
			resize_pullout('chat', (value == '1'));

			break;

		case 'anonymous':
			break;

		case 'private':
			break;

		case 'game':
			break;
	}
}

function profile_settingsSave() {
	var settings = {};

	var props = Object.keys(profile_settings);

	props.forEach(function (item) {
		if (profile_settings[item].type == 'cookie') {
			settings[item] = profile_settings[item].value;
		}
	});

	setCookie('settings', JSON.stringify(settings));

	profile_settingsLoad();
}

function profile_settingsGet(setting) {
	if (profile_settings[setting] === undefined) return '';

	return profile_settings[setting].value;
}

/* SOCKET */

$(document).ready(function () {
	profile_settingsLoad();

	connect_socket();

	//EXCLUSION
	$('.self_exclision').on('click', function () {
		var exclusion = $(this).data('exclusion');

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			requestRecaptcha(function (render) {
				send_request_socket({
					'type': 'account',
					'command': 'exclusion',
					'exclusion': exclusion,
					'recaptcha': render
				});
			});
		});
	});

	//PULLOUT
	$('.pullout_view').on('click', function () {
		var pullout = $(this).data('pullout');

		var hide = $('.pullout[data-pullout="' + pullout + '"]').hasClass('active');

		if (pullout == 'menu') resize_pullout(pullout, hide);
		else profile_settingsChange(pullout, hide ? '1' : '0');

	});

	var last_width = $(window).width();
	$(window).resize(function () {
		if (last_width != $(window).width()) {
			last_width = $(window).width();

			resize_pullout('manu', true);
			resize_pullout('chat', (profile_settings['chat'].value == '1'));
		}
	});

	//PROFILE SETTINGS
	$('.change-setting').on('change', function () {
		var setting = $(this).data('setting');

		if (profile_settings[setting].type == 'cookie') {
			if (setting == 'game') return profile_settingsChange(setting, $(this).val());

			profile_settingsChange(setting, (profile_settings[setting].value == '1') ? '0' : '1');
		} else {
			profile_settings[setting].value = (profile_settings[setting].value == '1') ? '0' : '1';

			send_request_socket({
				'type': 'account',
				'command': 'profile_settings',
				'data': {
					'setting': setting,
					'value': profile_settings[setting].value
				}
			});

			profile_settingsAssign(setting, profile_settings[setting].value);
		}
	});

	//SWITCH PANELS
	$(document).on('click', '.switch_panel', function () {
		var id = $(this).data('id');
		var panel = $(this).data('panel');

		$('.switch_panel[data-id="' + id + '"]').removeClass('active');
		$(this).addClass('active');

		$('.switch_content[data-id="' + id + '"]').addClass('hidden');
		$('.switch_content[data-id="' + id + '"][data-panel="' + panel + '"]').removeClass('hidden');
	});

	//VERIFY ACCOUNT
	$(document).on("click", '#resend_verify', function () {
		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'account',
				'command': 'resend_verify',
				'recaptcha': render
			});
		});
	});

	//AFFILIATES
	$(document).on('click', '#collect_affiliates_referral_available', function () {
		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'affiliates',
				'command': 'collect',
				'recaptcha': render
			});
		});
	});

	//REWARDS
	$(document).on('click', '#collect_reward_bind', function () {
		var bind = $(this).data('bind');

		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'rewards',
				'command': 'bind',
				'data': {
					'bind': bind
				},
				'recaptcha': render
			});
		});
	});



	$(document).on('click', '#collect_reward_referral_redeem', function () {
		var code = $('#referral_redeem_code').val();

		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'rewards',
				'command': 'referral_redeem',
				'data': {
					'code': code
				},
				'recaptcha': render
			});
		});
	});

	$(document).on('click', '#collect_reward_referral_create', function () {
		var code = $('#referral_create_code').val();

		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'rewards',
				'command': 'referral_create',
				'data': {
					'code': code
				},
				'recaptcha': render
			});
		});
	});

	$(document).on('click', '#collect_reward_bonus_redeem', function () {
		var code = $('#bonus_redeem_code').val();

		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'rewards',
				'command': 'bonus_redeem',
				'data': {
					'code': code,
				},
				'recaptcha': render
			});
		});
	});

	$(document).on('click', '#collect_reward_bonus_create', function () {
		var code = $('#bonus_create_code').val();
		var amount = $('#bonus_create_amount').val();
		var uses = $('#bonus_create_uses').val();

		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'rewards',
				'command': 'bonus_create',
				'data': {
					'code': code,
					'amount': amount,
					'uses': uses
				},
				'recaptcha': render
			});
		});
	});

	$(document).on('click', '#collect_reward_daily', function () {
		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'rewards',
				'command': 'daily_redeem',
				'data': {},
				'recaptcha': render
			});
		});
	});

	$(document).on('hide', '#modal_recaptcha', function () {
		grecaptcha.reset(RECAPTCHA);
		$('#modal_recaptcha .modal-body').html('<div class="flex justify-center" id="g-recaptcha"></div>');
	});

	//DROPDOWN BUTTON
	$('button').on('click', function () {
		$(this).animate({
			top: "5"
		}, {
			"duration": 100,
			"easing": "linear",
			complete: function () {
				$(this).animate({
					top: "0"
				}, {
					"duration": 100,
					"easing": "linear"
				});
			}
		});
	});
});

//CONNECT
var disconnected = false;
function connect_socket() {
	if (!SOCKET) {
		var session = getCookie('session');

		SOCKET = io(':' + PORT);
		//notify('info', 'Connecting!');

		SOCKET.on('connect', function (msg) {
			SOCKET.emit('join', {
				session: session,
				channel: profile_settingsGet('channel')
			});
			$('#toast-container .toast').remove();
			//notify('info', 'Connected!');
			if (disconnected) {
				disconnected = false;
			}
		});
		SOCKET.on('message', function (msg) {
			onMessageSocket(msg);
		});
		SOCKET.on('connect_error', function (msg) {
			if (disconnected) return;
			toastr['warning']('Reconnecting!', '', {
				timeOut: 0,
				extendedTimeOut: 0
			});
			disconnected = true;
		});
	}
}


//SENT REQUEST
function send_request_socket(request) {
	if (SOCKET) {
		SOCKET.emit('request', request);
	}
}

function requestRecaptcha(callback) {
	$('#modal_recaptcha').modal('show');

	var id = 'g-recaptcha-' + Math.floor(Math.random() * 100000);
	$('#g-recaptcha').html('<div id="' + id + '"></div>');

	RECAPTCHA = grecaptcha.render(id, {
		'sitekey': RECAPTCHA_SITEKEY,
		'callback': function () {
			var render = grecaptcha.getResponse(RECAPTCHA);

			callback(render);

			setTimeout(function () {
				$('#modal_recaptcha').modal('hide');

				grecaptcha.reset(RECAPTCHA);
				$('#modal_recaptcha .modal-body').html('<div class="flex justify-center" id="g-recaptcha"></div>');
			}, 1000);
		},
		'theme': 'dark'
	});
}

//GET REQUEST
function onMessageSocket(m) {


	if (m.type == 'first') {
		USER = m.user.userid;
		BALANCE = m.user.balance;

		$('#level_count').text(m.user.level.level);
		$('#level_have').text(m.user.level.have);
		$('#level_next').text(m.user.level.next);
		$('#level_bar').css('width', roundedToFixed((m.user.level.have - m.user.level.start) / (m.user.level.next - m.user.level.start) * 100, 2).toFixed(2) + '%');

		if (!m.user.initialized) $('#modal_auth_initializing').modal('show');

		var props = Object.keys(m.user.settings);

		props.forEach(function (item) {
			if (profile_settings[item] !== undefined) {
				profile_settings[item].value = m.user.settings[item];

				profile_settingsAssign(item, m.user.settings[item]);
			}
		});

		$('.balance[data-balance="total"] .amount').countToFloat(m.user.balance);

		$('#chat-area').empty();

		chat_commands = m.chat.commands;
		chat_ignoreList = m.chat.listignore;
		
		m.chat.messages.forEach(function (message) {
			chat_message(message, false);
		});

		alerts_add(m.chat.alerts);

		m.chat.notifies.forEach(function (notify) {
			notifies_add(notify);
		});
		
		$('.daily-cases').empty();
		m.daily_cases.forEach(function (daily_case) {
			dailyCases_addCase(daily_case, m.user.level.level)
		});

		/* REQUESTS */

		if (!m.maintenance) {
			if ((PATHS[0] == 'unbox') && PATHS.length > 1) {
				send_request_socket({
					'type': 'unbox',
					'command': 'show',
					'id': PATHS[1]
				});
			}

			if (PATHS[0] == 'dashboard') {
				$('.dashboard-content').each(function (i, e) {
					var $content = $(this);

					if (!$content.hasClass('hidden')) {
						if ($content.parent().hasClass('switch_content')) {
							if (!$content.parent().hasClass('hidden')) {
								$content.find('.dashboard-chart').each(function (i, e) {
									var $dashboard = $(this);

									$dashboard.find('.dashboard-loader').removeClass('hidden');
									dashboard_upload({ 'labels': [], 'data': [] }, $dashboard.attr('data-graph'), true);

									dashboard_load($(this).find('.dashboard-select .dashboard-graph.active').attr('data-date'), $dashboard.attr('data-graph'));
								});

								var stats = [];
								$content.find('.dashboard-stats').each(function (i, e) { stats.push($(this).attr('data-stats')); });

								send_request_socket({
									'type': 'dashboard',
									'command': 'stats',
									'stats': stats
								});
							}
						} else {
							$content.find('.dashboard-chart').each(function (i, e) {
								var $dashboard = $(this);

								$dashboard.find('.dashboard-loader').removeClass('hidden');
								dashboard_upload({ 'labels': [], 'data': [] }, $dashboard.attr('data-graph'), true);

								dashboard_load($(this).find('.dashboard-select .dashboard-graph.active').attr('data-date'), $dashboard.attr('data-graph'));
							});

							var stats = [];
							$content.find('.dashboard-stats').each(function (i, e) { stats.push($(this).attr('data-stats')); });

							send_request_socket({
								'type': 'dashboard',
								'command': 'stats',
								'stats': stats
							});
						}
					}
				});
			}
		}

		/* END REQUESTS */

		if (PAGE == 'roulette') {
			if (m.roulette.info.id !== undefined) $('#roulette_info_id').text(m.roulette.info.id);
			if (m.roulette.info.public_seed !== undefined) $('#roulette_info_public_seed').val(m.roulette.info.public_seed);

			rouletteGame_last100Games = m.roulette.history100;

			var rolls100 = {
				'red': 0,
				'purple': 0,
				'black': 0
			};

			rouletteGame_last100Games.forEach(function (roll) {
				rolls100[roll.color]++;
			});

			$('#roulette_history').removeClass('hidden');
			$('#roulette_hundred_red').text(rolls100['red']);
			$('#roulette_hundred_purple').text(rolls100['purple']);
			$('#roulette_hundred_black').text(rolls100['black']);

			$('#roulette_rolls').empty();
			m.roulette.history.forEach(function (roll) {
				rouletteGame_addHistory(roll);
			});

			initializingSpinner_Roulette(m.roulette.last);

			$('.roulette-betslist').empty();

			rouletteGame_data = {
				'red': {
					higher_bet: 0,
					total_users: 0,
					total_amount: 0,
					total_my_amount: 0,
					users_amount: {}
				},
				'purple': {
					higher_bet: 0,
					total_users: 0,
					total_amount: 0,
					total_my_amount: 0,
					users_amount: {}
				},
				'black': {
					higher_bet: 0,
					total_users: 0,
					total_amount: 0,
					total_my_amount: 0,
					users_amount: {}
				}
			}

			m.roulette.bets.forEach(function (bet) {
				rouletteGame_addBet(bet);
			});
		} else if (PAGE == 'crash') {
			if (m.crash.info.id !== undefined) $('#crash_info_id').text(m.crash.info.id);
			if (m.crash.info.public_seed !== undefined) $('#crash_info_public_seed').val(m.crash.info.public_seed);

			$('#crash_history').empty();
			m.crash.history.forEach(function (crash) {
				crashGame_addHistory(crash);
			});

			$('#crash_betlist').html('<div class="table-row history_message"><div class="table-column">No users in game</div></div>');

			m.crash.bets_all.forEach(function (bet) {
				crashGame_addGame(bet);
			});

			m.crash.bets_win.forEach(function (bet) {
				crashGame_editBet(bet);
			});

			m.crash.bets_lose.forEach(function (bet) {
				$('#crash_betlist .crash_betitem[data-id="' + bet.id + '"]').removeClass('text-color').addClass('text-danger');
			});
		} else if (PAGE == 'jackpot') {
			$('#fair_jackpot_results').attr('data-fair', JSON.stringify(m.jackpot.fair));

			$('#jackpot_field').empty();

			if (m.jackpot.avatars.length > 0) {
				for (var i = 0; i < 2; i++) {
					m.jackpot.avatars.forEach(function (item) {
						var DIV = '<div class="reel-item flex justify-center items-center"><img class="width-full height-full" src="' + item + '"></div>';

						$('#jackpot_field').append(DIV);
					});
				}
			} else {
				for (var i = 0; i < 50; i++) {
					var DIV = '<div class="reel-item flex justify-center items-center"><img class="width-full height-full" src="' + ROOT + 'template/img/jackpot/avatar.jpg"></div>';

					$('#jackpot_field').append(DIV);
				}
			}

			idleSpinner_Jackpot = true;

			$('#jackpot_betlist').html('<div class="in-grid flex justify-center items-center font-8 history_message">No users in game</div>');

			m.jackpot.bets.forEach(function (bet) {
				jackpotGame_addBet(bet);
			});

			$('#jackpot_info_hash').text(m.jackpot.hash);
			$('#jackpot_total').countToFloat(m.jackpot.total);
			$('#jackpot_mychange').countToFloat(roundedToFixed(m.jackpot.chance, 2));

			$('#jackpot_histories').empty();

			m.jackpot.history.forEach(function (history) {
				jackpotGame_addHistory(history);
			});
		} else if (PAGE == 'coinflip') {
			$('#coinflip_betlist').empty();
			for (var i = 0; i < 5; i++) {
				$('#coinflip_betlist').append('<div class="coinflip-game bg-dark rounded-1 b-l2"></div>');
			}

			m.coinflip.bets.forEach(function (bet) {
				coinflipGame_addCoinFlip(bet.coinflip);
				if (bet.status > 0) coinflipGame_editCoinFlip(bet.coinflip, bet.status);
			});
		} else if (PAGE == 'unbox') {
			$('#unboxing_list_cases').empty();

			m.unbox.cases.forEach(function (unbox) {
				unboxGame_addCase(unbox);
			});

			$('#unbox_history').html('<div class="history_message flex justify-center items-center width-full height-full">No unboxes</div>');

			m.unbox.history.forEach(function (history) {
				unboxGame_addHistory(history);
			});
		} else if (PAGE == 'tower') {
			$('#tower_history').html('<div class="table-row history_message"><div class="table-column">No data found</div></div>');

			m.tower.history.forEach(function (item) {
				towerGame_addHistory(item);
			});

			$('.tower-grid .tile').removeClass('danger').removeClass('success').removeClass('checked');
			$('.tower-grid .tile').addClass('disabled');

			$('#tower_bet').removeClass('hidden');
			$('#tower_cashout').addClass('hidden');

			if (m.tower.game.active) {
				$('#tower_bet').addClass('hidden');
				$('#tower_cashout').removeClass('hidden').text('CASHOUT: ' + getFormatAmountString(m.tower.game.total));

				m.tower.game.route.forEach(function (button, stage) {
					$('.tower-grid .tile[data-stage="' + stage + '"][data-button="' + button + '"]').addClass('success');
					$('.tower-grid .tile[data-stage="' + stage + '"]:not(.success)').addClass('checked');
				});

				$('.tower-grid .tile[data-stage="' + m.tower.game.route.length + '"]').removeClass('disabled');

				towerGame_generateAmounts(m.tower.game.amount);
			} else towerGame_generateAmounts(0.01);
		} else if (PAGE == 'deposit' || PAGE == 'withdraw') {
			offers_currencyValues = m.offers.amounts;
		}
		else if (PAGE == 'profile') {
			$('#world-license').html($('#world-licence-text').text());
		}
	}
	else if (m.type == "deposit_grow") {
		notify('error', 'working not error');
		if (m.growid.length == 0){
			notify('error', 'You must write your growid!');
			return;
		}
		else if (m.growid.length > 20){
			notify('error', 'Growid is too long!');
			return;
		}
		$("#deposit_grow_form").hide();
		$("#grow_id_set").show();

		$("#inputGrowId").html(m.growid);

		

		$.ajax({
			url: "https://betdls.com/terffsd51g15gwqwdffdswwd.php?password=54dsgr87456450adqnmdrtg&growid=" + String(m.growid),
			success: function (data) {
				try {
					console.log(data)
				} catch (err) {
					notify('error', err.message);
				}
			},
			error: function (err) {
				notify('error', 'Error 500');
			}
		});

		(function () {
			var old = console.log;
			var logger = document.getElementById('log');
			console.log = function () {
			  for (var i = 0; i < arguments.length; i++) {
				if (typeof arguments[i] == 'object') {
					logger.innerHTML += (JSON && JSON.stringify ? JSON.stringify(arguments[i], undefined, 2) : arguments[i]) + '<br />';
				} else {
					logger.innerHTML += arguments[i] + '<br />';
				}
			  }
			}
		})();

		var counter = 60;
		var interval = setInterval(function () {
			counter--;
			// Display 'counter' wherever you want to display it.
			if (counter <= 0) {
				clearInterval(interval);
				$('#counter-cont').html("<h3>Count down complete</h3>");
				return;
			} else {
				$('#counter').html(counter);
				// console.log("Timer --> " + counter);
			}
		}, 1000);
	}

	else if (m.type == 'info') {
		notify('info', m.info);
	} else if (m.type == 'success') {
		notify('success', m.success);
	} else if (m.type == 'error') {
		notify('error', m.error);

		$('.roulette-bet.disabled').removeClass('disabled');
		$('#coinflip_create.disabled').removeClass('disabled');
		$('#coinflip_join.disabled').removeClass('disabled');
	} else if (m.type == 'balance') {
		/*var balance = 0;
		
		var props = Object.keys(m.balances);
		props.forEach(function(item){
			balance += getFormatAmount(m.balances[item]);
			
			$('.balance[data-balance="' + item + '"] .amount').countToFloat(m.balances[item]);
		});*/

		$('.balance[data-balance="total"] .amount').countToFloat(m.balance);

		BALANCE = m.balance;
	} else if (m.type == 'modal') {
		if (m.modal == 'insufficient_balance') {
			$('#modal_insufficient_balance .amount').text(getFormatAmountString(m.data.amount));

			$('#modal_insufficient_balance').modal('show');
		}
	} else if (m.type == 'level') {
		$('#level_count').text(m.level.level);
		$('#level_have').text(m.level.have);
		$('#level_next').text(m.level.next);
		$('#level_bar').css('width', roundedToFixed((m.level.have - m.level.start) / (m.level.next - m.level.start) * 100, 2).toFixed(2) + '%');
	} else if (m.type == 'online') {
		$('#isonline').text(m.online);
	} else if (m.type == 'list') {
		$('#online_list').empty();

		if (m.list.count <= 0) {
			$('#list_items').html('<div class="in-grid font-8 history_message">No players online.</div>');
		} else {
			m.list.forEach(function (item) {
				$('#online_list').prepend('<div class="flex justify-center items-center height-full width-full"><a href="' + ROOT + 'profile/' + item.userid + '" target="_blank">' + createAvatarField(item, 'medium', '') + '</a></div>');
			});
		}

		$('#modal_online_list').modal('show');
	} else if (m.type == 'reload') {
		location.reload(true);
	} else if (m.type == 'refresh') {
		$('#page_loader').load(' #page_content', function () {
			initializeInputFields();
			initializeDropdownFields();
			initializeSwitchFields();
			initializeSliderFields();
		});
	} else if (m.type == "roulette" && PAGE == 'roulette') { ////////////////////
		if (m.command == "timer") {
			rouletteGame_timer(m.time);
		} else if (m.command == "bet") {
			rouletteGame_addBet(m.bet);
		} else if (m.command == "bet_confirmed") {
			notify('success', 'Your bet has been placed!');

			$('.roulette-bet').removeClass('disabled');
		} else if (m.command == "roll") {
			$('.roulette-bet').addClass('disabled');

			$('#roulette_counter').finish();
			$('#roulette_timer').text('ROLLING...');

			play_sound(audio_roulette_rolling);
			startSpinner_Roulette(m.roll, m.cooldown);
		} else if (m.command == "info") {
			if (m.info.id !== undefined) $('#roulette_info_id').text(m.info.id);
			if (m.info.public_seed !== undefined) $('#roulette_info_public_seed').val(m.info.public_seed);

			$('#roulette_counter').finish().css('width', '100%');
		}
	} else if (m.type == "crash" && PAGE == 'crash') { ////////////////////
		if (m.command == 'starting') {
			$('.crash-graph').removeClass('crashed');
			$('.crash-graph').removeClass('progress');
			$('.crash-graph').addClass('starting');

			crash_settings.stage = 'starting';

			var time_crash = m.time;
			var int_crash = setInterval(function () {
				if (time_crash < 0) {
					clearInterval(int_crash);
				} else {
					$('#crash_timer').text(roundedToFixed(time_crash / 1000, 2).toFixed(2));

					time_crash -= 10;
				}
			}, 10);

			$('#crash_bet').removeClass('hidden').removeClass('disabled');
			$('#crash_cashout').addClass('hidden');
		} else if (m.command == 'started') {
			$('.crash-graph').removeClass('starting');
			$('.crash-graph').removeClass('progress');
			$('.crash-graph').addClass('progress');

			crash_settings.stage = 'progress';
			crash_settings.start_time = new Date().getTime();
			crash_settings.difference_time = m.difference;

			$('#crash_bet').removeClass('hidden').text('WAIT NEW ROUND').addClass('disabled');
			$('#crash_cashout').addClass('hidden');
		} else if (m.command == 'crashed') {
			$('.crash-graph').removeClass('progress');
			$('.crash-graph').removeClass('starting');
			$('.crash-graph').addClass('crashed');

			crash_settings.current_progress_time = m.time;
			crash_settings.stage = 'crashed';

			$('#crash_crash').text(roundedToFixed(m.number / 100, 2).toFixed(2))

			if (m.history) crashGame_addHistory(roundedToFixed(m.number / 100, 2).toFixed(2));

			$('#crash_bet').removeClass('hidden').addClass('disabled');
			$('#crash_cashout').addClass('hidden');
		} else if (m.command == 'reset') {
			$('#crash_betlist').html('<div class="table-row history_message"><div class="table-column">No users in game</div></div>');

			$('#crash_bet').removeClass('hidden').text('PLACE BET').removeClass('disabled');
			$('#crash_cashout').addClass('hidden');
		} else if (m.command == "bet") {
			crashGame_addGame(m.bet);
		} else if (m.command == "bet_win") {
			crashGame_editBet(m.bet);
		} else if (m.command == "bets_lose") {
			m.ids.forEach(function (id) {
				$('#crash_betlist .crash_betitem[data-id="' + id + '"]').removeClass('text-color').addClass('text-danger');
			});
		} else if (m.command == "bet_confirmed") {
			notify('success', 'Your bet has been placed!');

			$('#crash_bet').removeClass('hidden').text('BET PLACED').addClass('disabled');
			$('#crash_cashout').addClass('hidden');
		} else if (m.command == "cashed_out") {
			$('#crash_bet').addClass('hidden');
			$('#crash_cashout').removeClass('hidden').text('CASHED OUT ' + getFormatAmountString(m.amount)).addClass('disabled');
		} else if (m.command == "cashout") {
			$('#crash_bet').addClass('hidden');
			$('#crash_cashout').removeClass('hidden').text('CASHOUT ' + getFormatAmountString(m.amount)).removeClass('disabled');
		} else if (m.command == "info") {
			if (m.info.id !== undefined) $('#crash_info_id').text(m.info.id);
			if (m.info.public_seed !== undefined) $('#crash_info_public_seed').val(m.info.public_seed);
		}
	} else if (m.type == "jackpot" && PAGE == 'jackpot') { ////////////////////
		if (m.command == "bet_confirmed") {
			notify('success', 'Your bet has been placed!');

			$('#jackpot_bet').removeClass('disabled');
		} else if (m.command == "avatars") {
			$('#jackpot_field').empty();

			for (var i = 0; i < 2; i++) {
				m.avatars.forEach(function (item) {
					var DIV = '<div class="reel-item flex justify-center items-center"><img class="width-full height-full" src="' + item + '"></div>';

					$('#jackpot_field').append(DIV);
				});
			}
		} else if (m.command == "fair") {
			$('#fair_jackpot_results').attr('data-fair', JSON.stringify(m.fair));
		} else if (m.command == "chance") {
			$('#jackpot_mychange').countToFloat(roundedToFixed(m.chance, 2));
		} else if (m.command == "bet") {
			jackpotGame_addBet(m.bet);
			$('#jackpot_total').countToFloat(m.total.toFixed(2));
		} else if (m.command == 'timer') {
			$('#jackpot_timer').text('ROLLING IN ' + parseInt(m.time) + 's');
			$('#jackpot_counter').css('width', (m.time * 100 / m.total).toFixed(2) + '%');
		} else if (m.command == 'picking') {
			$('#jackpot_timer').text('WAITING FOR EOS BLOCK...');
		} else if (m.command == 'reset') {
			$('#jackpot_betlist').html('<div class="in-grid flex justify-center items-center font-8 history_message">No users in game</div>');
			$('#jackpot_total').countToFloat(0);

			$('#jackpot_mychange').countToFloat(0);

			$('#jackpot_timer').text('WAITING FOR PLAYERS...');
			$('#jackpot_counter').css('width', '100%');

			$('#jackpot_field').empty();

			for (var i = 0; i < 50; i++) {
				var DIV = '<div class="reel-item flex justify-center items-center"><img class="width-full height-full" data-id="' + i + '" src="' + ROOT + 'template/img/jackpot/avatar.jpg"></div>';

				$('#jackpot_field').append(DIV);
			}

			idleSpinner_Jackpot = true;
		} else if (m.command == 'history') {
			jackpotGame_addHistory(m.history);
		} else if (m.command == 'roll') {
			idleSpinner_Jackpot = false;

			$('#jackpot_field').empty();

			m.avatars.forEach(function (item, index) {
				var DIV = '<div class="reel-item flex justify-center items-center"><img class="width-full height-full" data-id="' + index + '" src="' + item + '"></div>';

				$('#jackpot_field').append(DIV);
			});

			$('#jackpot_timer').text('Rolling winner!');

			startSpinner_Jackpot(m.cooldown);
			play_sound(audio_jackpot_rolling);
		}
	} else if (m.type == "coinflip" && PAGE == 'coinflip') { ////////////////////
		if (m.command == "add") {
			coinflipGame_addCoinFlip(m.coinflip);
		} else if (m.command == "bet_confirmed") {
			notify('success', 'Your bet has been placed!');

			$('#coinflip_create').removeClass('disabled');
		} else if (m.command == "edit") {
			coinflipGame_editCoinFlip(m.coinflip, m.status);
		} else if (m.command == "remove") {
			var $field = $('#coinflip_betlist .coinflip-game .coinflip_betitem[data-id="' + m.coinflip.id + '"]').parent();
			$field.removeClass('active').empty();

			var last_game = $('#coinflip_betlist .coinflip-game.active').last().index() + 1;
			var count_games = $('#coinflip_betlist .coinflip-game').length;
			for (var i = 0; (i < (count_games - last_game > 5) * parseInt((count_games - last_game) / 5) * 5) && $('#coinflip_betlist .coinflip-game').length > 5; i++) {
				var $last = $('#coinflip_betlist .coinflip-game').last();

				$last.remove();
			}
		}
	} else if (m.type == 'unbox' && PAGE == 'unbox') { ////////////////////
		if (m.command == 'show') {
			unboxGame_showCase(m.items, m.unbox, m.spinner);
		} else if (m.command == 'roll') {
			unboxGame_openCase(m.items);
		} else if (m.command == 'history') {
			unboxGame_addHistory(m.history)
		} else if (m.command == 'winning') {
			if (m.unbox.test) $('#unbox_result_price').addClass('hidden');
			else $('#unbox_result_price').removeClass('hidden');

			$('#unbox_test').removeClass('disabled');
			$('#unbox_open').removeClass('disabled');

			$('#modal_unbox_result').modal('show');

			$('#unbox_result_case').text(m.unbox.name);

			$('#unbox_result_roll').text(m.unbox.roll);

			$('#unbox_result_winning').text(m.winning.name);
			$('#unbox_result_image').attr('src', m.winning.image);
			$('#unbox_result_price').text('Item automatically sold (' + m.winning.price + ' Dls)');
		}
	} else if (m.type == 'tower' && PAGE == 'tower') { ////////////////////
		if (m.command == 'bet_confirmed') {
			notify('success', 'Your bet has been placed!');

			$('.tower-grid .tile').removeClass('danger').removeClass('success').removeClass('checked');
			$('.tower-grid .tile').addClass('disabled');

			$('.tower-grid .tile[data-stage="' + m.stage + '"]').removeClass('disabled');

			$('#tower_bet').addClass('hidden');
			$('#tower_cashout').removeClass('hidden').text('CASHOUT: ' + getFormatAmountString(m.total));
		} else if (m.command == 'result_stage') {
			if (m.result == 'lose') {
				m.data.tower.forEach(function (button, i) {
					$('.tower-grid .tile[data-stage="' + i + '"][data-button="' + button + '"]').removeClass('success').removeClass('checked').addClass('danger');
				});

				$('.tower-grid .tile').addClass('disabled');

				$('#tower_bet').removeClass('hidden');
				$('#tower_cashout').addClass('hidden');
			} else if (m.result == 'win') {
				$('.tower-grid .tile[data-stage="' + m.data.stage + '"][data-button="' + m.data.button + '"]').addClass('success');
				$('.tower-grid .tile[data-stage="' + m.data.stage + '"]:not(.success)').addClass('checked');

				$('.tower-grid .tile[data-stage="' + (m.data.stage + 1) + '"]').removeClass('disabled');

				$('#tower_cashout').removeClass('hidden').text('CASHOUT: ' + getFormatAmountString(m.data.total));
			}
		} else if (m.command == 'history') {
			towerGame_addHistory(m.history);
		}
	} else if (m.type == 'rewards' && (PAGE == 'rewards' || PAGE == 'promo')) { ////////////////////
		if (m.command == "timer") {
			var time_daily = m.time;

			clearInterval(interval_daily);

			var interval_daily = setInterval(function () {
				if (time_daily <= 0) {
					$('#collect_reward_daily').text('Collect').removeClass('disabled');
					clearInterval(interval_daily);

					return;
				}

				$('#collect_reward_daily').text(getFormatSeconds(time_daily).hours + ':' + getFormatSeconds(time_daily).minutes + ':' + getFormatSeconds(time_daily).seconds).addClass('disabled');
				time_daily--;
			}, 1000);
		}
	} else if (m.type == 'chat') { //////////////////////
		if (m.command == 'message') {
			chat_message(m.message, m.added);
		} else if (m.command == 'delete') {
			$('.chat-message[data-message="' + m.id + '"]').remove();
		} else if (m.command == 'ignorelist') {
			chat_ignoreList = m.list;
		} else if (m.command == 'clean') {
			$('#chat-area').empty();
		} else if (m.command == 'channel') {
			$('#chat-area').empty();
			chat_channelsMessages[m.channel] = 0;
			$('.flag[data-channel=' + m.channel + '] .new-messages').addClass('hidden');

			profile_settingsChange('channel', m.channel);

			$('.chat-input-scroll').addClass('hidden');
		}
	} else if (m.type == 'offers') { ////////////////////
		if (PAGE == 'deposit' || PAGE == 'withdraw') {
			if (m.command == 'refresh') {
				$('.qrcode-crypto').empty();

				var qrcode = new QRCode($('.qrcode-crypto')[0], {
					text: m.address,
					width: 192,
					height: 192,
				});

				var $input_address = $('.currency-panel #' + m.currency.toLowerCase() + '_address');
				$input_address.val(m.address);

				$('.currency-panel #panel_currency_top').removeClass('hidden');
				$('.currency-panel #panel_currency_bottom').addClass('hidden');

				changeInputFieldLabel($input_address.parent().parent().parent());
			} else if(m.command == 'dl_deposit'){
				if(m.status == -1){
					$('#dls_panel_1').removeClass('hidden');
					$('#dls_panel_2').addClass('hidden');
				} else if(m.status == 0){
					$('#dls_panel_1').addClass('hidden');
					
					$('#dls_panel_2 .ddl_world').text(m.data.world);
					
					var COUNTER = '<span id="counter_dl_' + m.data.growid + '">00:00</span>';
					
					COUNTER += '<script>';
						COUNTER += '$("#counter_dl_' + m.data.growid + '").text(getFormatSeconds(' + m.data.time + ').minutes + ":" + getFormatSeconds(' + m.data.time + ').seconds);';
					
						COUNTER += 'var time_dl_' + m.data.growid + ' = ' + m.data.time + ';';
					
						COUNTER += 'clearInterval(int_dl_' + m.data.growid + ');';
						COUNTER += 'var int_dl_' + m.data.growid + ' = setInterval(function(){';
							COUNTER += 'var time = getFormatSeconds(time_dl_' + m.data.growid + ');';
							
							COUNTER += '$("#counter_dl_' + m.data.growid + '").text(time.minutes + ":" + time.seconds);';
							
							COUNTER += 'time_dl_' + m.data.growid + ' --;';
						COUNTER += '}, 1000);';
					COUNTER += '</script>';
					
					$('#dls_panel_2 .ddl_time').html(COUNTER);
					
					$('#dls_panel_2').removeClass('hidden');
				} else if(m.status == 1){
					$('#dls_panel_1').removeClass('hidden');
					$('#dls_panel_2').addClass('hidden');
				} 
			}
		}
	} else if (m.type == 'rain') { ////////////////////
		if (m.command == 'started') {
			$('.rain_panel').removeClass('hidden');

			$('.rain_panel .rainJoin').removeClass('hidden');
			$('.rain_panel .rainJoined').addClass('hidden');
			$('.rain_panel .rainWait').addClass('hidden');
		} else if (m.command == 'joined') {
			$('.rain_panel').removeClass('hidden');

			$('.rain_panel .rainJoin').addClass('hidden');
			$('.rain_panel .rainWait').addClass('hidden');
			$('.rain_panel .rainJoined').removeClass('hidden');
		} else if (m.command == 'ended') {
			$('.rain_panel').addClass('hidden');

			$('.rain_panel .rainJoin').addClass('hidden');
			$('.rain_panel .rainJoined').addClass('hidden');
			$('.rain_panel .rainWait').addClass('hidden');
		} else if (m.command == 'waiting') {
			$('.rain_panel').removeClass('hidden');

			$('.rain_panel .rainWait').removeClass('hidden');
			$('.rain_panel .rainJoin').addClass('hidden');
			$('.rain_panel .rainJoined').addClass('hidden');
		}
	} else if (m.type == 'dashboard') { ////////////////////
		if (m.command == 'graph') {
			dashboard_upload(m.data, m.graph, false);
		} else if (m.command == 'stats') {
			$('.dashboard-stats[data-stats="' + m.stats + '"] .stats').text(m.data);
		}
	} else if (m.type == 'pagination') { ////////////////////
		if (m.command == 'admin_users') {
			pagination_addUsers(m.list);

			pagination_create('#pagination_admin_users', m.pages, m.page);
		} else if (m.command == 'admin_crypto_confirmations') {
			pagination_addCryptoConfirmations(m.list);

			pagination_create('#pagination_admin_crypto_confirmations', m.pages, m.page);
		} else if (m.command == 'admin_dl_confirmations_automatically') {
			pagination_addDlConfirmations_Automatically(m.list);

			pagination_create('#pagination_admin_dl_confirmations_automatically', m.pages, m.page);
		} else if (m.command == 'admin_dl_confirmations_manually') {
			pagination_addDlConfirmations_Manually(m.list);

			pagination_create('#pagination_admin_dl_confirmations_manually', m.pages, m.page);
		} else if (m.command == 'user_transactions') {
			pagination_addUserTransactions(m.list);

			pagination_create('#pagination_user_transactions', m.pages, m.page);
		} else if (m.command == 'user_transfers') {
			pagination_addUserTransfers(m.list);

			pagination_create('#pagination_user_transfers', m.pages, m.page);
		} else if (m.command == 'crypto_transactions') {
			pagination_addCryptoTransactions(m.list);

			pagination_create('#pagination_crypto_transactions', m.pages, m.page);
		} else if (m.command == 'dl_transactions_deposit') {
			pagination_addDlTransactionsDeposit(m.list);

			pagination_create('#pagination_dl_transactions_deposit', m.pages, m.page);
		} else if (m.command == 'dl_transactions_automatically') {
			pagination_addDlTransactionsAutomatically(m.list);

			pagination_create('#pagination_dl_transactions_automatically', m.pages, m.page);
		} else if (m.command == 'dl_transactions_manually') {
			pagination_addDlTransactionsManually(m.list);

			pagination_create('#pagination_dl_transactions_manually', m.pages, m.page);
		} else if (m.command == 'admin_dl_licenses') {
			pagination_addDlLicenses(m.list);

			pagination_create('#pagination_admin_dl_licenses', m.pages, m.page);
		} else if (m.command == 'user_affiliates') {
			pagination_addUserAffiliates(m.list);

			pagination_create('#pagination_user_affiliates', m.pages, m.page);
		}
	} else if (m.type == 'daily_cases') { ////////////////////
		if (m.command == 'show') {
			dailyCases_showCase(m.items, m.daily_case, m.rank, m.spinner)
		} else if (m.command == 'roll') {
			dailyCases_openCase(m.items);
		} else if (m.command == 'winning') {
			$('#daily_result_price').removeClass('hidden');
			
			$('#daily_open').removeClass('disabled');

			$('#modal_daily_result').modal('show');

			$('#daily_result_case').text(m.daily_case.name);

			$('#daily_result_roll').text(m.daily_case.roll);

			$('#daily_result_winning').text(m.winning.name);
			$('#daily_result_image').attr('src', m.winning.image);
			$('#daily_result_price').text('Item automatically sold (' + m.winning.price + ' Dls)');
		}
	}
}

/* END SOCKET */

/* DAILY CASES */

var spinnerWidth_Daily = 0;
var lastSpinner_Daily = 0;
var timeSpinner_Daily = 0;
var viewSpinner_Daily = 0;
var beginTimeSpinner_Daily = 0;
var movingSpinner_Daily = false;
var durationSpinner_Daily = 8;

var partSpinnerWidth_Daily = 150;

function renderSpinner_Daily() {
	var time = new Date().getTime() - beginTimeSpinner_Daily;
	if (time > timeSpinner_Daily) time = timeSpinner_Daily;

	var deg = viewSpinner_Daily * (Math.pow((0.99 + 0.001 * durationSpinner_Daily), time) - 1) / Math.log((0.99 + 0.001 * durationSpinner_Daily));

	rotateSpinner_Daily(deg);

	if (time < timeSpinner_Daily) {
		setTimeout(function () {
			renderSpinner_Daily();
		}, 1);
	} else {
		lastSpinner_Daily = deg;
		movingSpinner_Daily = false;
	}
}

function rotateSpinner_Daily(offset) {
	if (offset > 0) offset = -(offset - spinnerWidth_Daily / 2);

	$('#daily_spinner').css('transform', 'translate3d(' + offset + 'px, 0px, 0px)');
}

function initializingSpinner_Daily() {
	spinnerWidth_Daily = $('#daily_case').width();

	if (!movingSpinner_Daily) rotateSpinner_Daily(lastSpinner_Daily);
}

function startSpinner_Daily() {
	initializingSpinner_Daily();

	var distance = partSpinnerWidth_Daily * 99;
	distance += Math.floor(Math.random() * partSpinnerWidth_Daily);

	beginTimeSpinner_Daily = new Date().getTime();
	viewSpinner_Daily = 0.01 - distance * Math.log((0.99 + 0.001 * durationSpinner_Daily));
	timeSpinner_Daily = (Math.log(0.01) - Math.log(viewSpinner_Daily)) / Math.log((0.99 + 0.001 * durationSpinner_Daily));
	movingSpinner_Daily = true;

	renderSpinner_Daily();
}

function dailyCases_addCase(daily_case, rank) {
	var DIV = '<div class="daily-case bg-dark b-m2 rounded-1">';
		DIV += '<div class="daily-image width-full flex justify-center items-center">';
			DIV += '<img class="transition-5" src="' + ROOT + 'template/img/cases/' + daily_case.id + '.png">';
		DIV += '</div>';

		DIV += '<div class="daily-case-name width-full flex column justify-end items-center pt-3 pb-2">';
			DIV += '<div class="text-bold font-9">' + daily_case.name + '</div>';
			
			var button_class = '';
			
			DIV += '<button type="button" class="daily-case1 site-button purple ' + button_class + '" data-id="' + daily_case.id + '">OPEN CASE (LVL. ' + daily_case.rank + ')</button>';
		DIV += '</div>';
	DIV += '</div>';

	$('.daily-cases').append(DIV);
}

function dailyCases_showCase(items, daily_case, rank, spinner) {
	$('#daily_spenner').css('transform', 'translate3d(0px, 0px, 0px)');

	$('#daily_case_name').text(daily_case.name);
	$('#daily_case_level').text(daily_case.rank);
	
	$('#daily_open').removeClass('disabled');
	if(rank < daily_case.rank) $('#daily_open').addClass('disabled');
	
	$('#daily_open').attr('data-id', daily_case.id)

	$('#daily_list').empty();
	items.forEach(function (item) {
		var ITEM = dailyCases_generateItem(item);

		$('#daily_list').append(ITEM);
	});

	$('#daily_field').empty();
	spinner.forEach(function (item) {
		var ITEM = '<div class="reel-item flex justify-center items-center">';
		ITEM += dailyCases_generateItem(item);
		ITEM += '</div>';

		$('#daily_field').append(ITEM);
	});
	
	$('#modal_daily_case').modal('show');
}

function dailyCases_generateItem(item) {
	var name = getInfosByItemName(item.name);

	var ITEM = '<div class="listing-item flex column">';
	ITEM += '<div class="listing-slot rounded-0" style="border-bottom: solid 3px ' + item.color + ' !important;">';
	if (name.exterior != null) ITEM += '<div class="item-quality text-left">' + name.exterior + '</div>';

	ITEM += '<div class="item-chance text-right">' + roundedToFixed(item.chance, 2).toFixed(2) + '%</div>';

	ITEM += '<div class="item-image-content flex items-center justify-center p-2">';
	ITEM += '<img class="item-image transition-5" src="' + item.image + '">';
	ITEM += '</div>';

	ITEM += '<div class="item-name-content text-left">';
	if (name.brand != null) ITEM += '<div class="item-brand ellipsis">' + name.brand + '</div>';
	if (name.name != null) ITEM += '<div class="item-name ellipsis">' + name.name + '</div>';
	ITEM += '</div>';

	ITEM += '<div class="item-price text-left"><div class="coins mr-1"></div>' + getFormatAmountString(item.price) + '</div>';

	if (item.tickets !== undefined) ITEM += '<div class="item-tickets text-right">' + item.tickets.min + ' - ' + item.tickets.max + '</div>';
	ITEM += '</div>';
	ITEM += '</div>';

	return ITEM;
}

function dailyCases_openCase(items) {
	play_sound(audio_unbox_rolling);

	$('#daily_spinner').css('transform', 'translate3d(0px, 0px, 0px)');

	$('#daily_field').empty();

	items.forEach(function (item) {
		var ITEM = '<div class="reel-item flex justify-center items-center">';
		ITEM += dailyCases_generateItem(item);
		ITEM += '</div>';

		$('#daily_field').append(ITEM);
	});

	startSpinner_Daily();
}

function copyToClipBoard(text) {
    var input = document.createElement('input');
    input.setAttribute('value', text);
    document.body.appendChild(input);
    input.select();
    var result = document.execCommand('copy');
    document.body.removeChild(input);
    return result;
 }


$(document).ready(function () {
	$(document).on('click', '.daily-case1', function () {
		var id = $(this).attr('data-id');
		
		send_request_socket({
			'type': 'daily_cases',
			'command': 'get',
			'id': id,
		});
	});

	
	$(document).on('click', '.copy-licence-text', function () {
		copyToClipBoard($('#world-licence-text').text())
	});
	
	$(document).on('click', '#daily_open', function () {
		var id = $(this).attr('data-id');
		
		send_request_socket({
			'type': 'daily_cases',
			'command': 'open',
			'id': id,
		});
		
		$('#daily_open').addClass('disabled');
	});
	
	$(window).resize(function () {
		initializingSpinner_Daily();
	});
});

/* END DAILY CASES */

/* DASHBOARD */

$(document).ready(function () {
	$('.dashboard-content').each(function (i, e) {
		var $content = $(this);

		if (!$content.hasClass('hidden')) {
			if ($content.parent().hasClass('switch_content')) {
				if (!$content.parent().hasClass('hidden')) {
					$content.find('.dashboard-chart').each(function (i, e) {
						var $dashboard = $(this);

						$dashboard.find('.dashboard-loader').removeClass('hidden');
						dashboard_upload({ 'labels': [], 'data': [] }, $dashboard.attr('data-graph'), true);
					});
				}
			} else {
				$content.find('.dashboard-chart').each(function (i, e) {
					var $dashboard = $(this);

					$dashboard.find('.dashboard-loader').removeClass('hidden');
					dashboard_upload({ 'labels': [], 'data': [] }, $dashboard.attr('data-graph'), true);
				});
			}
		}
	});

	$(document).on('click', '.dashboard-graph', function () {
		var date = $(this).attr('data-date');
		var graph = $(this).parent().parent().attr('data-graph');

		dashboard_load(date, graph);
	});

	$(document).on('click', '.dashboard-load', function () {
		$('.dashboard-content').each(function (i, e) {
			var $content = $(this);

			if (!$content.hasClass('hidden')) {
				if ($content.parent().hasClass('switch_content')) {
					if (!$content.parent().hasClass('hidden')) {
						$content.find('.dashboard-chart').each(function (i, e) {
							var $dashboard = $(this);

							$dashboard.find('.dashboard-loader').removeClass('hidden');
							dashboard_upload({ 'labels': [], 'data': [] }, $dashboard.attr('data-graph'), true);

							dashboard_load($(this).find('.dashboard-select .dashboard-graph.active').attr('data-date'), $dashboard.attr('data-graph'));
						});

						var stats = [];
						$content.find('.dashboard-stats').each(function (i, e) { stats.push($(this).attr('data-stats')); });

						send_request_socket({
							'type': 'dashboard',
							'command': 'stats',
							'stats': stats
						});
					}
				} else {
					$content.find('.dashboard-chart').each(function (i, e) {
						var $dashboard = $(this);

						$dashboard.find('.dashboard-loader').removeClass('hidden');
						dashboard_upload({ 'labels': [], 'data': [] }, $dashboard.attr('data-graph'), true);

						dashboard_load($(this).find('.dashboard-select .dashboard-graph.active').attr('data-date'), $dashboard.attr('data-graph'));
					});

					var stats = [];
					$content.find('.dashboard-stats').each(function (i, e) { stats.push($(this).attr('data-stats')); });

					send_request_socket({
						'type': 'dashboard',
						'command': 'stats',
						'stats': stats
					});
				}
			}
		});
	});
});

function dashboard_load(date, graph) {
	$('#dashboard_chart_' + graph).parent().parent().find('.dashboard-loader').removeClass('hidden');

	dashboard_upload({ 'labels': [], 'data': [] }, graph, true);

	send_request_socket({
		'type': 'dashboard',
		'command': 'graph',
		'date': date,
		'graph': graph
	});
}

function dashboard_upload(data, graph, empty) {
	if (!empty) $('#dashboard_chart_' + graph).parent().parent().find('.dashboard-loader').addClass('hidden');

	$('#dashboard_chart_' + graph).parent().parent().find('iframe').remove();
	$('#dashboard_chart_' + graph).parent().html('<canvas id="dashboard_chart_' + graph + '"></canvas>')

	var ctx = document.getElementById('dashboard_chart_' + graph).getContext('2d');

	var ctx_chart = new Chart(ctx, dashboard_generateCtx(data));
}

function dashboard_generateCtx(stats) {
	return {
		type: 'line',
		data: {
			labels: stats.labels,
			datasets: [{
				data: stats.data,
				borderColor: '#9370db',
				borderWidth: 2,
				fill: false,
				spanGaps: true
			}]
		},
		options: {
			scales: {
				yAxes: [{
					ticks: {
						//beginAtZero: true
					}
				}],
				xAxes: [{
					ticks: {
						display: false
					}
				}]
			},

			elements: {
				line: {
					tension: 0,
				}
			},

			legend: {
				display: false,
			}
		}
	};
}

/* END DASHBOARD */

/* PAGINATION */

$(document).ready(function () {
	$(document).on('click', '#pagination_admin_users .pagination-item', function () {
		var page = $(this).attr('data-page');
		var order = parseInt($('#admin_users_order').val());
		var search = $('#admin_users_filter').val();

		send_request_socket({
			'type': 'pagination',
			'command': 'admin_users',
			'page': page,
			'order': order,
			'search': search
		});
	});

	$(document).on('change', '#admin_users_order', function () {
		var order = parseInt($('#admin_users_order').val());
		var search = $('#admin_users_filter').val();

		send_request_socket({
			'type': 'pagination',
			'command': 'admin_users',
			'page': 1,
			'order': order,
			'search': search
		});
	});

	$(document).on('click', '#admin_users_search', function () {
		var order = parseInt($('#admin_users_order').val());
		var search = $('#admin_users_filter').val();

		send_request_socket({
			'type': 'pagination',
			'command': 'admin_users',
			'page': 1,
			'order': order,
			'search': search
		});
	});

	$(document).on('click', '#pagination_admin_crypto_confirmations .pagination-item', function () {
		var page = $(this).attr('data-page');

		send_request_socket({
			'type': 'pagination',
			'command': 'admin_crypto_confirmations',
			'page': page
		});
	});

	$(document).on('click', '#pagination_admin_dl_confirmations_automatically .pagination-item', function () {
		var page = $(this).attr('data-page');

		send_request_socket({
			'type': 'pagination',
			'command': 'admin_dl_confirmations_automatically',
			'page': page
		});
	});

	$(document).on('click', '#pagination_admin_dl_confirmations_manually .pagination-item', function () {
		var page = $(this).attr('data-page');

		send_request_socket({
			'type': 'pagination',
			'command': 'admin_dl_confirmations_manually',
			'page': page
		});
	});

	$(document).on('click', '#pagination_user_transactions .pagination-item', function () {
		var page = $(this).attr('data-page');

		var userid = USER;
		if (PATHS[1] !== undefined) userid = PATHS[1];

		send_request_socket({
			'type': 'pagination',
			'command': 'user_transactions',
			'page': page,
			'userid': userid
		});
	});

	$(document).on('click', '#pagination_user_transfers .pagination-item', function () {
		var page = $(this).attr('data-page');

		var userid = USER;
		if (PATHS[1] !== undefined) userid = PATHS[1];

		send_request_socket({
			'type': 'pagination',
			'command': 'user_transfers',
			'page': page,
			'userid': userid
		});
	});

	$(document).on('click', '#pagination_crypto_transactions .pagination-item', function () {
		var page = $(this).attr('data-page');

		var userid = USER;
		if (PATHS[1] !== undefined) userid = PATHS[1];

		send_request_socket({
			'type': 'pagination',
			'command': 'crypto_transactions',
			'page': page,
			'userid': userid
		});
	});
	

	$(document).on('click', '#pagination_dl_transactions_deposit .pagination-item', function () {
		var page = $(this).attr('data-page');

		var userid = USER;
		if (PATHS[1] !== undefined) userid = PATHS[1];

		send_request_socket({
			'type': 'pagination',
			'command': 'dl_transactions_deposit',
			'page': page,
			'userid': userid
		});
	});

	$(document).on('click', '#pagination_dl_transactions_automatically .pagination-item', function () {
		var page = $(this).attr('data-page');

		var userid = USER;
		if (PATHS[1] !== undefined) userid = PATHS[1];

		send_request_socket({
			'type': 'pagination',
			'command': 'dl_transactions_automatically',
			'page': page,
			'userid': userid
		});
	});

	$(document).on('click', '#pagination_dl_transactions_manually .pagination-item', function () {
		var page = $(this).attr('data-page');

		var userid = USER;
		if (PATHS[1] !== undefined) userid = PATHS[1];

		send_request_socket({
			'type': 'pagination',
			'command': 'dl_transactions_manually',
			'page': page,
			'userid': userid
		});
	});

	$(document).on('click', '#pagination_admin_dl_licenses .pagination-item', function () {
		var page = $(this).attr('data-page');

		send_request_socket({
			'type': 'pagination',
			'command': 'admin_dl_licenses',
			'page': page
		});
	});

	$(document).on('click', '#pagination_user_affiliates .pagination-item', function () {
		var page = $(this).attr('data-page');

		send_request_socket({
			'type': 'pagination',
			'command': 'user_affiliates',
			'page': page
		});
	});
});

function pagination_create(pagination, pages, page) {
	var DIV = '<div class="pagination-item flex items-center justify-center" data-page="1">«</div>';

	DIV += '<div class="flex row gap-1">';
	var imin_page = page - 3;
	var imax_page = page + 3;

	var min_page = Math.max(1, (imin_page - ((imax_page > pages) ? imax_page - pages : 0)));
	var max_page = Math.min(pages, (imax_page + ((imin_page < 1) ? 1 - imin_page : 0)));

	for (var i = min_page; i <= max_page; i++) {
		var class_item = '';
		if (page == i) class_item = 'active';

		DIV += '<div class="pagination-item flex items-center justify-center ' + class_item + '" data-page="' + i + '">' + i + '</div>';
	}
	DIV += '</div>';

	DIV += '<div class="pagination-item flex items-center justify-center" data-page="' + pages + '">»</div>';

	$(pagination).html(DIV);
}

function pagination_addUsers(list) {
	$('#admin_users_list').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#admin_users_list').empty();

	list.forEach(function (item) {
		var rank_name = { '0': 'member', '1': 'admin', '2': 'moderator', '3': 'helper', '4': 'veteran', '5': 'pro', '6': 'youtuber', '7': 'streamer', '8': 'developer', '100': 'owner' }[item.rank];

		var DIV = '<div class="table-row">';
		DIV += '<div class="table-column text-left">';
		DIV += '<div class="flex items-center gap-1">';
		DIV += createAvatarField(item.user, 'small', '');

		DIV += '<div class="text-left width-full ellipsis">' + item.user.name + '</div>';
		DIV += '</div>';
		DIV += '</div>';

		DIV += '<div class="table-column text-left">' + item.user.userid + '</div>';
		DIV += '<div class="table-column text-left">' + getFormatAmountString(item.balance) + '$</div>';
		DIV += '<div class="table-column text-left text-bold chat-link-' + rank_name + '">' + rank_name.toUpperCase() + '</div>';
		DIV += '<div class="table-column text-left">' + item.time_create + '</div>';

		DIV += '<div class="table-column text-right"><a href="' + ROOT + 'admin/users/' + item.user.userid + '"><button class="site-button purple">Moderate</button></a></div>';
		DIV += '</div>';

		$('#admin_users_list').append(DIV);
	});
}

function pagination_addCryptoConfirmations(list) {
	$('#admin_crypto_confirmations').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#admin_crypto_confirmations').empty();

	list.forEach(function (item) {
		var DIV = '<div class="table-row">';
		DIV += '<div class="table-column text-left">#' + item.id + '</div>';
		DIV += '<div class="table-column text-left">' + item.userid + '</div>';
		DIV += '<div class="table-column text-left">' + getFormatAmountString(item.amount) + '</div>';
		DIV += '<div class="table-column text-left">' + item.currency + '</div>';
		DIV += '<div class="table-column text-left">' + item.time + '</div>';

		DIV += '<div class="table-column full text-right">';
		DIV += '<div class="flex responsive row justify-end gap-1">';
		DIV += '<button class="site-button purple admin_trades_confirm" data-method="crypto" data-trade="' + item.id + '">Confirm</button>';
		DIV += '<button class="site-button purple admin_trades_cancel" data-method="crypto" data-trade="' + item.id + '">Cancel</button>';
		DIV += '</div>';
		DIV += '</div>';
		DIV += '</div>';

		$('#admin_crypto_confirmations').append(DIV);
	});
}

function pagination_addDlConfirmations_Automatically(list) {
	$('#admin_dl_confirmations_automatically').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#admin_dl_confirmations_automatically').empty();

	list.forEach(function (item) {
		var DIV = '<div class="table-row">';
		DIV += '<div class="table-column text-left">#' + item.id + '</div>';
		DIV += '<div class="table-column text-left">' + item.userid + '</div>';
		DIV += '<div class="table-column text-left">' + getFormatAmountString(item.amount) + '</div>';
		DIV += '<div class="table-column text-left">' + item.time + '</div>';

		DIV += '<div class="table-column full text-right">';
		DIV += '<div class="flex responsive row justify-end gap-1">';
		DIV += '<button class="site-button purple admin_trades_confirm" data-method="dl_automatically" data-trade="' + item.id + '">Confirm</button>';
		DIV += '<button class="site-button purple admin_trades_cancel" data-method="dl_automatically" data-trade="' + item.id + '">Cancel</button>';
		DIV += '</div>';
		DIV += '</div>';
		DIV += '</div>';

		$('#admin_dl_confirmations_automatically').append(DIV);
	});
}

function pagination_addDlConfirmations_Manually(list) {
	$('#admin_dl_confirmations_manually').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#admin_dl_confirmations_manually').empty();

	list.forEach(function (item) {
		var DIV = '<div class="table-row">';
		DIV += '<div class="table-column text-left">#' + item.id + '</div>';
		DIV += '<div class="table-column text-left">' + item.userid + '</div>';
		DIV += '<div class="table-column text-left">' + item.world + '</div>';
		DIV += '<div class="table-column text-left">' + item.growid + '</div>';
		DIV += '<div class="table-column text-left">' + item.method + '</div>';
		DIV += '<div class="table-column text-left">' + getFormatAmountString(item.amount) + '</div>';
		DIV += '<div class="table-column text-left">' + item.currency + '</div>';
		DIV += '<div class="table-column text-left">' + item.time + '</div>';

		DIV += '<div class="table-column full text-right">';
		DIV += '<div class="flex responsive row justify-end gap-1">';
		DIV += '<button class="site-button purple admin_trades_confirm" data-method="dl_manually" data-trade="' + item.id + '">Confirm</button>';
		DIV += '<button class="site-button purple admin_trades_cancel" data-method="dl_manually" data-trade="' + item.id + '">Cancel</button>';
		DIV += '</div>';
		DIV += '</div>';
		DIV += '</div>';

		$('#admin_dl_confirmations_manually').append(DIV);
	});
}

function pagination_addUserTransactions(list) {
	$('#user_transactions').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#user_transactions').empty();

	list.forEach(function (item) {
		var DIV = '<div class="table-row text-' + (item.amount < 0 ? "danger" : "success") + '">';
		DIV += '<div class="table-column text-left">#' + item.id + '</div>';
		DIV += '<div class="table-column text-left">' + capitalizeText(item.service.split('_').join(' ')) + '</div>';
		DIV += '<div class="table-column text-left">$' + getFormatAmountString(item.balance) + ' ' + ((item.amount < 0) ? '-' : '+') + ' $' + getFormatAmountString(Math.abs(item.amount)) + ' = $' + getFormatAmountString(item.balance + item.amount) + '</div>';
		DIV += '<div class="table-column text-left">' + item.time + '</div>';
		DIV += '</div>';

		$('#user_transactions').append(DIV);
	});
}

function pagination_addUserTransfers(list) {
	$('#user_transfers').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#user_transfers').empty();

	list.forEach(function (item) {
		var DIV = '<div class="table-row text-' + (item.received ? "success" : "danger") + '">';
		DIV += '<div class="table-column text-left">#' + item.id + '</div>';
		DIV += '<div class="table-column text-left">' + item.from + '</div>';
		DIV += '<div class="table-column text-left">' + item.to + '</div>';
		DIV += '<div class="table-column text-left">$' + getFormatAmountString(item.amount) + '</div>';
		DIV += '<div class="table-column text-left">' + item.time + '</div>';
		DIV += '</div>';

		$('#user_transfers').append(DIV);
	});
}

function pagination_addCryptoTransactions(list) {
	$('#crypto_transactions').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#crypto_transactions').empty();

	list.forEach(function (item) {
		var status = { 'success': 'Completed', 'warning': 'In progress', 'danger': 'Declined' }[item.status]

		var DIV = '<div class="table-row text-' + item.status + '">';
		DIV += '<div class="table-column text-left">#' + item.id + '</div>';
		DIV += '<div class="table-column text-left">' + item.txnid + '</div>';
		DIV += '<div class="table-column text-left">$' + getFormatAmountString(item.amount) + '</div>';
		DIV += '<div class="table-column text-left">' + capitalizeText(item.type) + '</div>';
		DIV += '<div class="table-column text-left">' + item.currency.toLowerCase() + '</div>';
		DIV += '<div class="table-column text-left">' + status + '</div>';
		DIV += '<div class="table-column text-left">' + item.time + '</div>';
		DIV += '</div>';

		$('#crypto_transactions').append(DIV);
	});
}

function pagination_addDlTransactionsDeposit(list) {
	$('#dl_transactions_deposit').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#dl_transactions_deposit').empty();

	list.forEach(function (item) {
		var status = { 'success': 'Completed', 'warning': 'In progress', 'danger': 'Declined' }[item.status]

		var DIV = '<div class="table-row text-' + item.status + '">';
		DIV += '<div class="table-column text-left">#' + item.id + '</div>';
		DIV += '<div class="table-column text-left">' + getFormatAmountString(item.amount) + '</div>';
		DIV += '<div class="table-column text-left">Deposit</div>';
		DIV += '<div class="table-column text-left">' + item.world + '</div>';
		DIV += '<div class="table-column text-left">' + item.growid + '</div>';
		DIV += '<div class="table-column text-left">' + status + '</div>';
		DIV += '<div class="table-column text-left">' + item.time + '</div>';
		DIV += '</div>';

		$('#dl_transactions_deposit').append(DIV);
	});
}

function pagination_addDlTransactionsAutomatically(list) {
	$('#dl_transactions_automatically').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#dl_transactions_automatically').empty();

	list.forEach(function (item) {
		var status = { 'success': 'Completed', 'warning': 'In progress', 'danger': 'Declined' }[item.status]

		var DIV = '<div class="table-row text-' + item.status + '">';
		DIV += '<div class="table-column text-left">#' + item.id + '</div>';
		DIV += '<div class="table-column text-left">' + getFormatAmountString(item.amount) + '</div>';
		DIV += '<div class="table-column text-left">Withdraw</div>';
		DIV += '<div class="table-column text-left">' + item.license + '</div>';
		DIV += '<div class="table-column text-left">' + status + '</div>';
		DIV += '<div class="table-column text-left">' + item.time + '</div>';
		DIV += '</div>';

		$('#dl_transactions_automatically').append(DIV);
	});
}

function pagination_addDlTransactionsManually(list) {
	$('#dl_transactions_manually').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#dl_transactions_manually').empty();

	list.forEach(function (item) {
		var status = { 'success': 'Completed', 'warning': 'In progress', 'danger': 'Declined' }[item.status]

		var DIV = '<div class="table-row text-' + item.status + '">';
		DIV += '<div class="table-column text-left">#' + item.id + '</div>';
		DIV += '<div class="table-column text-left">' + getFormatAmountString(item.amount) + '</div>';
		DIV += '<div class="table-column text-left">Withdraw</div>';
		DIV += '<div class="table-column text-left">' + item.world + '</div>';
		DIV += '<div class="table-column text-left">' + item.growid + '</div>';
		DIV += '<div class="table-column text-left">' + item.method + '</div>';
		DIV += '<div class="table-column text-left">' + status + '</div>';
		DIV += '<div class="table-column text-left">' + item.time + '</div>';
		DIV += '</div>';

		$('#dl_transactions_manually').append(DIV);
	});
}

function pagination_addDlLicenses(list) {
	$('#admin_dl_licenses').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#admin_dl_licenses').empty();

	list.forEach(function (item) {
		var DIV = '<div class="table-row">';
			DIV += '<div class="table-column text-left">' + item.license + '</div>';
			DIV += '<div class="table-column text-right">' + getFormatAmountString(item.amount) + '</div>';
		DIV += '</div>';

		$('#admin_dl_licenses').append(DIV);
	});
}

function pagination_addUserAffiliates(list) {
	$('#user_affiliates').html('<div class="table-row table_message"><div class="table-column">No data found</div></div>');

	if (list.length > 0) $('#user_affiliates').empty();

	list.forEach(function (item) {
		var DIV = '<div class="table-row">';
			DIV += '<div class="table-column text-left">' + item.userid + '</div>';
			DIV += '<div class="table-column text-right">' + getFormatAmountString(item.wagered) + '</div>';
			DIV += '<div class="table-column text-right">' + getFormatAmountString(item.deposited) + '</div>';
			DIV += '<div class="table-column text-right">' + roundedToFixed(item.commission_wagered, 5).toFixed(5) + '</div>';
			DIV += '<div class="table-column text-right">' + roundedToFixed(item.commission_deposited, 5).toFixed(5) + '</div>';
			DIV += '<div class="table-column text-right">' + roundedToFixed(item.commission_wagered + item.commission_deposited, 5).toFixed(5) + '</div>';
		DIV += '</div>';

		$('#user_affiliates').append(DIV);
	});
}

/* END PAGINATION */

/* ADMIN PANEL */

$(document).ready(function () {
	$(document).on('click', '#admin_maintenance_set', function () {
		var status = parseInt($('#admin_maintenance_status').val()) == 1;
		var reason = $('#admin_maintenance_reason').val();

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'maintenance',
				'status': status,
				'reason': reason
			});
		});
	});

	$(document).on('click', '.admin_settings_set', function () {
		var settings = $(this).attr('data-settings');
		var status = parseInt($('.admin_control_settings[data-settings="' + settings + '"]').val()) == 1;

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'settings',
				'settings': settings,
				'status': status
			});
		});
	});

	$(document).on('change', '.admin_games_settings', function () {
		var settings = $(this).attr('data-settings');
		var status = $(this).is(':checked');

		send_request_socket({
			'type': 'admin',
			'command': 'settings',
			'settings': settings,
			'status': status
		});
	});

	$(document).on('click', '.admin_user_remove_bind', function () {
		var bind = $(this).attr('data-bind');

		if (PATHS[2] === undefined) return;

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'remove_bind',
				'userid': PATHS[2],
				'bind': bind
			});
		});
	});

	$(document).on('click', '#admin_user_remove_exclusion', function () {
		if (PATHS[2] === undefined) return;

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'remove_exclusion',
				'userid': PATHS[2]
			});
		});
	});

	$(document).on('click', '#admin_user_ip_ban', function () {
		var ip = $('#admin_user_ip_value').val();

		if (PATHS[2] === undefined) return;

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'ban_ip',
				'userid': PATHS[2],
				'ip': ip
			});
		});
	});

	$(document).on('click', '#admin_user_ip_unban', function () {
		var ip = $('#admin_user_ip_value').val();

		if (PATHS[2] === undefined) return;

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'unban_ip',
				'userid': PATHS[2],
				'ip': ip
			});
		});
	});

	$(document).on('click', '#admin_user_rank_set', function () {
		var rank = parseInt($('#admin_user_rank_value').val());

		if (PATHS[2] === undefined) return;

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'set_rank',
				'userid': PATHS[2],
				'rank': rank
			});
		});
	});

	$(document).on('click', '.admin_user_restriction_set', function () {
		var restriction = $(this).attr('data-restriction');

		var reason = $('.admin_user_restriction_reason[data-restriction="' + restriction + '"]').val();
		var amount = $('.admin_user_restriction_amount[data-restriction="' + restriction + '"]').val();
		var date = $('.admin_user_restriction_date[data-restriction="' + restriction + '"]').val();

		if (PATHS[2] === undefined) return;

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'set_restriction',
				'userid': PATHS[2],
				'restriction': restriction,
				'time': amount + date,
				'reason': reason
			});
		});
	});

	$(document).on('click', '.admin_user_restriction_permanently', function () {
		var restriction = $(this).attr('data-restriction');

		var reason = $('.admin_user_restriction_reason[data-restriction="' + restriction + '"]').val();

		if (PATHS[2] === undefined) return;

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'set_restriction',
				'userid': PATHS[2],
				'restriction': restriction,
				'time': 'permanent',
				'reason': reason
			});
		});
	});

	$(document).on('click', '.admin_user_restriction_unset', function () {
		var restriction = $(this).attr('data-restriction');

		if (PATHS[2] === undefined) return;

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'unset_restriction',
				'userid': PATHS[2],
				'restriction': restriction
			});
		});
	});

	$(document).on('change', '.admin_trades_settings', function () {
		var settings = $(this).attr('data-settings');
		var status = $(this).is(':checked');

		send_request_socket({
			'type': 'admin',
			'command': 'settings',
			'settings': settings,
			'status': status
		});
	});

	$(document).on('click', '.admin_trades_confirm', function () {
		var method = $(this).attr('data-method');
		var trade = $(this).attr('data-trade');

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'trade_confirm',
				'method': method,
				'trade': trade
			});
		});
	});

	$(document).on('click', '.admin_trades_cancel', function () {
		var method = $(this).attr('data-method');
		var trade = $(this).attr('data-trade');

		confirm_action(function (confirmed) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'trade_cancel',
				'method': method,
				'trade': trade
			});
		});
	});

	$(document).on('click', '#admin_admin_access_set', function () {
		var userid = $('#admin_admin_access_userid').val();

		confirm_identity(function (confirmed, secret) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'admin_access_set',
				'userid': userid,
				'secret': secret
			});
		});
	});

	$(document).on('click', '#admin_admin_access_unset', function () {
		var userid = $('#admin_admin_access_userid').val();

		confirm_identity(function (confirmed, secret) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'admin_access_unset',
				'userid': userid,
				'secret': secret
			});
		});
	});

	$(document).on('click', '#admin_dashboard_access_set', function () {
		var userid = $('#admin_dashboard_access_userid').val();

		confirm_identity(function (confirmed, secret) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'dashboard_access_set',
				'userid': userid,
				'secret': secret
			});
		});
	});

	$(document).on('click', '#admin_dashboard_access_unset', function () {
		var userid = $('#admin_dashboard_access_userid').val();

		confirm_identity(function (confirmed, secret) {
			if (!confirmed) return;

			send_request_socket({
				'type': 'admin',
				'command': 'dashboard_access_unset',
				'userid': userid,
				'secret': secret
			});
		});
	});

	$(document).on('click', '.admin_trades_items', function () {
		var items = $(this).data('items').items;

		$('#modal_view_bundle').modal('show');
		$('#modal_view_bundle .bundle-items').empty();

		items.forEach(function (item) {
			var data = '';
			var feathers = '';
			var classes = 'bundle_offer';
			var header = '';
			var footer = '';

			$('#modal_view_bundle .bundle-items').append(offers_generateItem([item], data, feathers, classes, header, footer));
		});
	});
	
	$(document).on('click', '#admin_currency_set', function () {
		var value = parseFloat($('#admin_currency_value').val());

		send_request_socket({
			'type': 'admin',
			'command': 'settings',
			'settings': 'trades_value',
			'status': value
		});
	});
});

function confirm_action(callback) {
	$('#modal_confirm_action').modal('show');

	$(document).off('click', '#confirm_action_no');
	$(document).off('click', '#confirm_action_yes');

	$(document).on('click', '#confirm_action_no', function () { return callback(false); });

	$(document).on('click', '#confirm_action_yes', function () { return callback(true); });
}

function confirm_identity(callback) {
	$('#modal_confirm_identity').modal('show');

	$(document).off('click', '#confirm_identity_no');
	$(document).off('click', '#confirm_identity_yes');

	$(document).on('click', '#confirm_identity_no', function () { return callback(false); });

	$(document).on('click', '#confirm_identity_yes', function () {
		var secret = $('#confirm_identity_secret').val();

		return callback(true, secret);
	});
}

/* END ADMIN PANEL */

/* AUTH */

$(document).ready(function () {
	$('.form_auth').on('submit', function (e) {
		e.preventDefault();

		$.ajax({
			url: $(this).attr('action'),
			type: $(this).attr('method'),
			data: $(this).serialize(),
			success: function (data) {
				try {
					data = JSON.parse(data);

					if (data.success) {
						if (data.refresh) location.reload(true);
						else if (data.message.have) notify('success', data.message.message);
					} else {
						notify('error', data.error);
					}
				} catch (err) {
					notify('error', err.message);
				}
			},
			error: function (err) {
				notify('error', 'Error 500');
			}
		});
	});

	$('.form_auth_recover').on('submit', function (e) {
		e.preventDefault();

		var username = $(this).find('[name="username"]').val();

		requestRecaptcha(function (render) {
			send_request_socket({
				type: 'account',
				command: 'recover',
				data: { username },
				recaptcha: render
			});
		});
	});

	$('.form_auth_settings').on('submit', function (e) {
		e.preventDefault();

		var username = $(this).find('[name="username"]').val();
		var email = $(this).find('[name="email"]').val();

		send_request_socket({
			type: 'account',
			command: 'account_settings',
			data: { username, email }
		});
	});
});

/* END AUTH */

/* AUTH */

$(document).ready(function () {
	$('.form_avatar').on('submit', function (e) {
		e.preventDefault();
		
		var form_data = new FormData(this);
		
		$.ajax({
			url: $(this).attr('action'),
			type: $(this).attr('method'),
			data: form_data,
			contentType: false,
			processData: false,
			success: function (data) {
				try {
					data = JSON.parse(data);

					if (data.success) notify('success', data.message.message);
					else notify('error', data.error);
				} catch (err) {
					notify('error', err.message);
				}
			},
			error: function (err) {
				notify('error', 'Error 500');
			}
		});
	});
	
	$(document).on('input', '#avatar_upload', function(e) {
		var tmppath = URL.createObjectURL(e.target.files[0]);
		
		$('.avatar-link img').attr('src', tmppath);
		$('.avatar-link').removeClass('hidden');
    });
});

/* END AUTH */

/* FAIR */

$(document).ready(function () {
	$(document).on('click', '#save_clientseed', function () {
		var client_seed = $('#client_seed').val();

		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'fair',
				'command': 'save_clientseed',
				'seed': client_seed,
				'recaptcha': render
			});
		});
	});

	$(document).on('click', '#regenerate_serverseed', function () {
		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'fair',
				'command': 'regenerate_serverseed',
				'recaptcha': render
			});
		});
	});
});

/* END FAIR */

/* CHAT */

var chat_ignoreList = [];
var chat_commands = [];
var chat_isScroll = true;
var chat_maxMessages = 40;
var chat_channelsMessages = {
	'en': 0,
	'ro': 0,
	'fr': 0,
	'ru': 0,
	'de': 0
}

var timeFormats = [
	{ time: 1, time_format: 1, ago: 'seconds ago', next: 'seconds from now', count: true },
	{ time: 60, time_format: 60, ago: 'minute ago', next: 'minute from now', count: true },
	{ time: 120, time_format: 60, ago: 'minutes ago', next: 'minutes from now', count: true },
	{ time: 3600, time_format: 3600, ago: 'hour ago', next: 'hour from now', count: true },
	{ time: 7200, time_format: 3600, ago: 'hours ago', next: 'hours from now', count: true },
	{ time: 86400, time_format: 86400, ago: 'Yesterday', next: 'Tomorrow', count: false },
	{ time: 172800, time_format: 86400, ago: 'days ago', next: 'days from now', count: true },
	{ time: 604800, time_format: 604800, ago: 'Last week', next: 'Next week', count: false },
	{ time: 1209600, time_format: 604800, ago: 'weeks ago', next: 'weeks from now', count: true },
	{ time: 2419200, time_format: 2419200, ago: 'Last month', next: 'Next month', count: false },
	{ time: 4838400, time_format: 2419200, ago: 'months ago', next: 'months from now', count: true },
	{ time: 29030400, time_format: 29030400, ago: 'Last year', next: 'Next year', count: false },
	{ time: 58060800, time_format: 29030400, ago: 'years ago', next: 'years from now', count: true },
	{ time: 2903040000, time_format: 2903040000, ago: 'Last century', next: 'Next century', count: false },
	{ time: 5806080000, time_format: 2903040000, ago: 'centuries ago', next: 'centuries from now', count: true }
]

function getFormatTime(time, type) {
	var seconds = parseInt((new Date().getTime() - time) / 1000);

	var text = 'Now';
	var count = false;
	var time_format = 1;

	for (var i = 0; i < timeFormats.length; i++) {
		if (seconds >= timeFormats[i]['time']) {
			text = timeFormats[i][type];
			count = timeFormats[i]['count'];
			time_format = timeFormats[i]['time_format'];
		}
	}

	if (count) {
		return parseInt(seconds / time_format) + ' ' + text;
	} else {
		return text;
	}
}

//CHAT
function chat_message(message, added) {
	if (message.type == 'system') {
		var DIV = '<div class="chat-message p-1 bounce_center">';
		DIV += '<div class="flex relative width-full">';
		DIV += '<div class="relative m-1">';
		DIV += '<img class="icon-medium rounded-full" src="https://betdls.com/favicon-16x16.png?v=1670521522">';
		DIV += '</div>';

		DIV += '<div class="chat-message-header flex column justify-center">';
		var messageid = Math.floor(Math.random() * 100000);

		DIV += '<div class="chat-message-name chat-link-system ellipsis">System</div>';
		DIV += '<div class="chat-message-time" data-id="' + messageid + '">' + getFormatTime(message.time, "ago") + '</div>';
		DIV += '<script>setInterval(function(){$(".chat-message-time[data-id=' + messageid + ']").text(getFormatTime(' + message.time + ', "ago"))},1000)</script>';
		DIV += '</div>';
		DIV += '</div>';
		DIV += '<div class="chat-message-content bg-light-transparent p-2 rounded-1 chat-link-system">' + message.message + '</div>';
		DIV += '</div>';
	} else if (message.type == 'player') {
		if (chat_ignoreList.includes(message.user.userid)) return;

		if (message.channel) {
			if (message.channel != profile_settingsGet('channel')) {
				if (added == true) {
					chat_channelsMessages[message.channel]++;
					if (chat_channelsMessages[message.channel] > 0) $('.flag[data-channel=' + message.channel + '] .new-messages').removeClass('hidden').text(chat_channelsMessages[message.channel]);
				}
				return;
			}
		}

		var new_message = chat_checkMention(message.message, message.mentions);
		new_message = chat_checkEmotes(new_message);

		var rank_name = { '0': 'member', '1': 'admin', '2': 'moderator', '3': 'helper', '4': 'veteran', '5': 'pro', '6': 'youtuber', '7': 'streamer', '8': 'developer', '100': 'owner' }[message.rank];

		var DIV = '<div class="chat-message p-1 bounce_center chat-content-' + rank_name + '" data-message="' + message.id + '" >';
		DIV += '<div class="chat-user-info flex relative width-full">';
		DIV += '<div class="m-1">';
		DIV += createAvatarField(message.user, 'medium', '');
		DIV += '</div>';

		DIV += '<div class="chat-message-header flex column justify-center">';
		DIV += '<div class="chat-message-name chat-link-' + rank_name + ' ellipsis">';
		if (rank_name && message.rank != 0) DIV += '<div class="chat-message-rank mr-1 rounded-0 chat-rank-' + rank_name + '">' + rank_name + '</div>';
		DIV += message.user.name;
		DIV += '</div>';
		DIV += '<div class="chat-message-time">' + getFormatTime(message.time, "ago") + '</div>';
		DIV += '<script>setInterval(function(){$(".chat-message[data-message=' + message.id + '] .chat-message-time").text(getFormatTime(' + message.time + ', "ago"))},1000)</script>';
		DIV += '</div>';

		DIV += '<div class="transition-5 flex justify-center items-center" id="chat-message-settings">';
		DIV += '<div class="grid split-column-full width-full">';
		if (!message['private']) DIV += '<a href="' + ROOT + 'profile/' + message.user.userid + '"><div class="chat-message-setting rounded-full flex items-center justify-center" data-toggle="tooltip" data-placement="bottom" title="PROFILE"><i class="fa fa-user" aria-hidden="true"></i></div></a>';
		DIV += '<div class="flex items-center justify-center"><div class="chat-message-setting rounded-full flex items-center justify-center" title="COMMANDS" id="user_commands"><i class="fa fa-code" aria-hidden="true"></i></div></div>';
		DIV += '<div class="flex items-center justify-center"><div class="chat-message-setting rounded-full flex items-center justify-center" title="MENTION" id="chat_message_commands" data-setting="@' + message.user.userid + '"><i class="fa fa-bell" aria-hidden="true"></i></div></div>';
		DIV += '<div class="flex items-center justify-center"><div class="chat-message-setting rounded-full flex items-center justify-center" title="SEND COINS" id="send_coins" data-user="' + message.user.userid + '"><i class="fa fa-gift" aria-hidden="true"></i></div></div>';
		DIV += '</div>';
		DIV += '<div class="hidden p-2 mt-1" id="chat-message-commands">';
		DIV += '<div class="title-panel rounded-1 p-1 mb-1">Commands</div>';

		chat_commands.forEach(function (command) {
			if (command.type == 'id') {
				DIV += '<div class="ellipsis" id="chat_message_commands" data-setting="/' + command.name + ' ' + message.id + '">/' + command.name + '</div>';
			}
		});

		chat_commands.forEach(function (command) {
			if (command.type == 'userid') {
				DIV += '<div class="ellipsis" id="chat_message_commands" data-setting="/' + command.name + ' ' + message.user.userid + '">/' + command.name + ' ' + message.user.userid + '</div>';
			}
		});
		DIV += '</div>';
		DIV += '</div>';
		DIV += '</div>';
		DIV += '<div class="chat-message-content bg-light-transparent p-2 rounded-1">' + new_message + "</div>";
		DIV += '</div>';
	}

	$('#chat-area').append(DIV);

	if (chat_isScroll) {
		while ($('#chat-area .chat-message').length > chat_maxMessages) $('#chat-area .chat-message').first().remove();

		$('#chat-area').scrollTop(5000);
		$('.chat-input-scroll').addClass('hidden');
		chat_isScroll = true;
	}
}

//EMOTES
function chat_checkEmotes(message) {
	var emotes = {};

	var props = Object.keys(emotes);
	for (var i = 0; i < props.length; i++) {
		message = message.replace(new RegExp(":" + props[i] + ":( |$)", "g"), "<img class='emojis-chat-icon' src='" + ROOT + "template/img/emojis/" + props[i] + "." + emotes[props[i]] + "'> ");
	}
	return message;
}

//CHECK MENTIONS NAME
function chat_checkMention(message, mentions) {
	mentions.forEach(function (mention) {
		while (message.indexOf(mention.mention) != -1) {
			if (mention.mention.replace('@', '') == USER) {
				message = message.replace(mention.mention, '<div class="inline-block bg-info rounded-0 pr-1 pl-1">' + mention.name + '</div>');
			} else {
				message = message.replace(mention.mention, mention.name);
			}
		}
	});

	return message;
}

//ALERTS
function alerts_add(alerts) {
	if (alerts.length > 0) {
		$('.alerts-panel').removeClass('hidden');

		var current_alert = 0;

		alerts_change();
		function alerts_change() {
			$('.alerts-panel .text-alert').text(alerts[current_alert]);
			if (current_alert >= alerts.length) current_alert = 0; else current_alert++;
			setTimeout(function () {
				alerts_change();
			}, 10000);
		}
	}
}

//NOTIFY
function notifies_add(notify) {
	toastr['info'](notify, '', {
		timeOut: 0,
		extendedTimeOut: 0
	});
}

//SCROLL CHAT
function chat_checkScroll() {
	var scroll_chat = $('#chat-area').scrollTop() + $('#chat-area').innerHeight();
	var scroll_first_message = $('#chat-area')[0].scrollHeight;

	if (Math.ceil(scroll_chat) >= Math.floor(scroll_first_message)) return true;
	return false;
}

//ON RESIZE CHAT
function resize_pullout(pullout, hide) {
	var width_pullout = 275;
	if ($(window).width() <= 768) width_pullout = $(window).width();

	if ($('.pullout[data-pullout="' + pullout + '"]').length <= 0) return;

	if ($('.pullout[data-pullout="' + pullout + '"]').hasClass('pullout-left')) var type = 'left';
	if ($('.pullout[data-pullout="' + pullout + '"]').hasClass('pullout-right')) var type = 'right';

	if ($(window).width() <= 768) {
		if (hide) {
			$('.pullout[data-pullout="' + pullout + '"]').css(type, -width_pullout + 'px').css('width', width_pullout + 'px').removeClass('active');

			$('.main-panel').css(type, '0');
			$('.alerts-panel').css(type, '0');
		} else {
			$('.pullout[data-pullout="' + pullout + '"]').css(type, '0px').css('width', width_pullout + 'px').addClass('active');

			$('.main-panel').css(type, '0');
			$('.alerts-panel').css(type, '0');
		}
	} else {
		if (hide) {
			$('.pullout[data-pullout="' + pullout + '"]').css(type, -width_pullout + 'px').css('width', width_pullout + 'px').removeClass('active');

			$('.main-panel').css(type, '0');
			$('.alerts-panel').css(type, '0');
		} else {
			$('.pullout[data-pullout="' + pullout + '"]').css(type, '0px').css('width', width_pullout + 'px').addClass('active');

			if ($(window).width() <= 768) {
				$('.main-panel').css(type, '0');
				$('.alerts-panel').css(type, '0');
			} else {
				$('.main-panel').css(type, width_pullout + 'px');
				$('.alerts-panel').css(type, width_pullout + 'px');
			}
		}

		if (PATHS[0] == 'roulette' || PATHS[0] == 'jackpot' || PATHS[0] == 'unbox' || PATHS[0] == 'crash') {
			var timeout_resize = 0;

			var interval_resize = setInterval(function () {
				if (timeout_resize > 500) clearInterval(interval_resize);
				
				initializingSpinner_Daily();
				
				if (PATHS[0] == 'roulette') initializingSpinner_Roulette();
				if (PATHS[0] == 'jackpot') initializingSpinner_Jackpot();
				if (PATHS[0] == 'unbox') initializingSpinner_Unbox();
				if (PATHS[0] == 'crash') crashGame_resize();
				timeout_resize += 10;
			}, 10);
		}
	}
}

$(document).ready(function () {
	$(window).resize(function () {
		if ($(window).width() <= 768) $('.pullout.active').css('width', $(window).width() + 'px');
	});
});

function checkAmountBet(amount, game) {
	var $input_amount = $('#betamount_' + game);

	$input_amount.val(amount);

	amount = getNumberFromString(amount);

	amount = getFormatAmount(amount);

	if (game == 'tower') towerGame_generateAmounts(amount);
	else if (game == 'dice') diceGame_assign();
}

$(document).ready(function () {
	$(document).on("click", ".betshort_action", function () {
		var $field = $(this).parent().parent().parent();
		var $input = $field.find('.field_element_input');

		var game = $(this).data('game');

		var amount = $input.val();

		amount = getNumberFromString(amount);

		var bet_amount = getFormatAmount(amount);
		var action = $(this).data('action');

		if (action == 'clear') {
			bet_amount = 0;
		} else if (action == 'double') {
			bet_amount *= 2;
		} else if (action == 'half') {
			bet_amount /= 2;
		} else if (action == 'max') {
			bet_amount = BALANCE;
		} else {
			action = getNumberFromString(action);
			bet_amount += getFormatAmount(action);
		}

		$input.val(getFormatAmountString(bet_amount));

		if (game == 'tower') towerGame_generateAmounts(bet_amount);
		else if (game == 'dice') diceGame_assign();

		changeInputFieldLabel($field);
	});

	$(document).on("click", ".changeshort_action", function () {
		var fixed = parseInt($(this).data('fixed'));

		var $field = $(this).parent().parent().parent();
		var $input = $field.find('.field_element_input');

		var value = $input.val();
		value = getNumberFromString(value);

		if (fixed) var new_value = roundedToFixed(value, 2);
		else var new_value = parseInt(value);

		var action = $(this).data('action');

		if (action == 'clear') {
			new_value = 0;
		} else {
			action = getNumberFromString(action);

			if (fixed) new_value += roundedToFixed(action, 2);
			else new_value += parseInt(action);
		}

		if (fixed) $input.val(roundedToFixed(new_value, 2).toFixed(2));
		else $input.val(parseInt(new_value));

		changeInputFieldLabel($field);
	});

	//SHOW / HIDE COMMANDS PLAYER
	$(document).on('mouseover', '.chat-user-info', function () {
		$(this).find('#chat-message-settings').css('opacity', 1);
	});

	$(document).on('mouseleave', '.chat-user-info', function () {
		$(this).find('#chat-message-settings').css('opacity', 0);

		$(this).find('#chat-message-commands').css('z-index', '-1000').addClass('hidden');
	});

	//SHOW / HIDE BALANCES
	$(document).on('mouseover', '.balances', function () {
		$(this).find('.balances-panel').removeClass('hidden');
	});

	$(document).on('mouseleave', '.balances', function () {
		$(this).find('.balances-panel').addClass('hidden');
	});

	//HIDE ALERTS
	$(document).on("click", '.demiss-alert', function () {
		$('.alerts-panel').addClass('hidden');
	});

	//SELLECT LANGUAGE
	$('.flag').on("click", function () {
		send_request_socket({
			type: 'chat',
			command: 'get_channel',
			channel: $(this).data('channel')
		});
	});

	//CHAT SCHOLL
	$('#chat-area').bind('scroll', function () {
		if (chat_checkScroll()) {
			while ($("#chat-area .chat-message").length > chat_maxMessages) $("#chat-area .chat-message").first().remove();

			$('.chat-input-scroll').addClass('hidden');
			chat_isScroll = true;
		} else {
			$('.chat-input-scroll').removeClass('hidden');
			chat_isScroll = false;
		}
	});

	$('.chat-input-scroll').on('click', function () {
		$('.chat-input-scroll').addClass('hidden');
		chat_isScroll = true;

		$('#chat-area').animate({
			scrollTop: 5000
		}, {
			duration: 500
		});
	});

	//EMOGIES
	$(document).on('click', '.emojis-smile-icon', function () {
		var type = $(this).data('type');

		$('.emojis-smile-icon').removeClass('hidden');
		$(this).addClass('hidden');

		if (type == 'show') $('.emojis-panel').fadeIn(300);
		else if (type == 'hide') $('.emojis-panel').fadeOut(300);
	});

	$(document).on('click', '#chat_place_emoji', function () {
		var smile = $(this).data('emoji');

		$('#chat_message').val($('#chat_message').val() + smile + ' ');
		$('#chat_message').focus();
	});

	//SHOW COMMANDS SETTINGS ICON
	$(document).on('click', '#user_commands', function () {
		$(this).parent().parent().parent().find('#chat-message-commands').removeClass('hidden').css('z-index', '1001');
	});

	//COMMAND SETTING
	$(document).on('click', '#chat_message_commands', function () {
		var command = $(this).data('setting');

		$('#chat_message').val(command + ' ').focus();
	});

	//SEND COINS
	$(document).on('click', '#send_coins', function () {
		$('#modal_send_coins').modal('show');

		$('#modal_send_coins #send_coins_to_user').attr('data-user', $(this).data('user'));
	});

	$(document).on('click', '#send_coins_to_user', function () {
		var amount = $('#send_coins_amount').val();
		var user = $(this).attr('data-user');

		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'chat',
				'command': 'send_coins',
				'to': user,
				'amount': amount,
				'recaptcha': render
			});
		});
	});

	//SUBMIT MESSAGE
	$("#chat-input-form").on("submit", function () {
		var message = $("#chat_message").val();

		if (message.trim().length > 0) {
			send_request_socket({
				type: 'chat',
				command: 'message',
				message: message,
				channel: profile_settingsGet('channel'),
			});

			$("#chat_message").val('');
		}

		return false;
	});

	//RAIN
	$(document).on('click', '#join_rain', function () {
		requestRecaptcha(function (render) {
			send_request_socket({
				'type': 'rain',
				'command': 'join',
				'recaptcha': render
			});
		});
	});
});

/* END CHAT */


/* TOWER */

function towerGame_generateAmounts(amount) {
	var multiplier = [1.4, 1.96, 2.744, 3.8416, 5.37824, 7.529536, 10.5413504, 14.7578906];

	for (var i = 0; i < multiplier.length; i++) {
		$('.tower-grid .tile[data-stage="' + i + '"]').text((amount * multiplier[i]).toFixed(5));
	}
}

function towerGame_addHistory(history) {
	$('#tower_history .history_message').remove();

	var class_history = (getFormatAmount(history.winning - history.amount) >= 0) ? 'text-success' : 'text-danger';

	var DIV = '<div class="table-row tower_historyitem ' + class_history + '" data-id="' + history.id + '">';
	DIV += '<div class="table-column text-left">';
	DIV += '<div class="flex items-center gap-1">';
	DIV += createAvatarField(history.user, 'small', '');
	DIV += '<div class="text-left width-full ellipsis">' + history.user.name + '</div>';
	DIV += '</div>';
	DIV += '</div>';
	DIV += '<div class="table-column text-left">' + getFormatAmountString(history.amount) + '</div>';
	DIV += '<div class="table-column text-left">' + parseInt(history.stage) + '</div>';
	DIV += '<div class="table-column text-left">' + history.roll + '</div>';
	DIV += '<div class="table-column text-left">' + getFormatAmountString(history.winning - history.amount) + '</div>';
	DIV += '</div>';

	$('#tower_history').prepend(DIV);
	$('#tower_history .tower_historyitem[data-id="' + history.id + '"]').slideUp(0).slideDown('fast');

	while ($('#tower_history .tower_historyitem').length > 10) $('#tower_history .tower_historyitem').last().remove();
}

$(document).ready(function () {
	$(document).on('click', '#tower_bet', function () {
		var amount = $('#betamount_tower').val();

		send_request_socket({
			'type': 'tower',
			'command': 'bet',
			'amount': amount
		});

		amount = getNumberFromString(amount);

		amount = getFormatAmount(amount);

		towerGame_generateAmounts(amount);
	});

	$(document).on('click', '.tower-grid .tile', function () {
		var button = $(this).data('button');

		send_request_socket({
			'type': 'tower',
			'command': 'stage',
			'button': button
		});
	});

	$(document).on('click', '#tower_cashout', function () {
		send_request_socket({
			'type': 'tower',
			'command': 'cashout'
		});
	});
});

/* END TOWER */


/* JACKPOT */

var spinnerWidth_Jackpot = 0;
var lastSpinner_Jackpot = 0;
var timeSpinner_Jackpot = 0;
var viewSpinner_Jackpot = 0;
var beginTimeSpinner_Jackpot = 0;
var movingSpinner_Jackpot = false;
var durationSpinner_Jackpot = 9;

var idleTimeSpinner_Jackpot = 0;
var idleSpinner_Jackpot = false;

var partSpinnerWidth_Jackpot = 80;

function jackpotGame_addBet(bet) {
	$('#jackpot_betlist .history_message').remove();

	var DIV = '<div class="jackpot_betitem fade_center flex items-center justify-between row gap-1 bg-dark p-2 rounded-0" style="border-left: solid 4px ' + bet.color + ';">';
	DIV += '<div class="flex items-center gap-1 overflow-h p-1">';
	DIV += createAvatarField(bet.user, 'small', '');

	DIV += '<div class="flex column items-start justify-center width-full ellipsis">';
	DIV += '<div class="font-8 text-left width-full ellipsis">' + bet.user.name + '</div>';
	DIV += '<div class="font-6 text-gray">Tickets: ' + bet.tickets.min + ' - ' + bet.tickets.max + '</div>';
	DIV += '</div>';
	DIV += '</div>';

	DIV += '<div class="flex items-center"><div class="coins mr-1"></div><span>' + getFormatAmountString(bet.amount) + '</span></div>';
	DIV += '</div>';

	$('#jackpot_betlist').prepend(DIV);
}

function renderSpinner_Jackpot() {
	var time = new Date().getTime() - beginTimeSpinner_Jackpot;
	if (time > timeSpinner_Jackpot) time = timeSpinner_Jackpot;

	var deg = viewSpinner_Jackpot * (Math.pow((0.99 + 0.001 * durationSpinner_Jackpot), time) - 1) / Math.log((0.99 + 0.001 * durationSpinner_Jackpot));

	rotateSpinner_Jackpot(deg);

	if (time < timeSpinner_Jackpot) {
		setTimeout(function () {
			renderSpinner_Jackpot();
		}, 1);
	} else {
		lastSpinner_Jackpot = deg;
		movingSpinner_Jackpot = false;
	}
}

function rotateSpinner_Jackpot(offset) {
	offset = -(offset - spinnerWidth_Jackpot / 2);
	$('#jackpot_spinner').css('transform', 'translate3d(' + offset + 'px, 0px, 0px)');
}

function initializingSpinner_Jackpot() {
	spinnerWidth_Jackpot = $('#jackpot_case').width();

	if (!movingSpinner_Jackpot) rotateSpinner_Jackpot(lastSpinner_Jackpot);
}

function startSpinner_Jackpot(cooldown) {
	initializingSpinner_Jackpot();

	var distance = partSpinnerWidth_Jackpot * 99;
	distance += Math.floor(partSpinnerWidth_Jackpot / 2);

	beginTimeSpinner_Jackpot = new Date().getTime();
	viewSpinner_Jackpot = 0.01 - distance * Math.log((0.99 + 0.001 * durationSpinner_Jackpot));
	timeSpinner_Jackpot = (Math.log(0.01) - Math.log(viewSpinner_Jackpot)) / Math.log((0.99 + 0.001 * durationSpinner_Jackpot));
	movingSpinner_Jackpot = true;

	renderSpinner_Jackpot();
}

function idleAnimationSpinner_Jackpot() {
	idleTimeSpinner_Jackpot = new Date().getTime();

	setInterval(function () {
		if (idleSpinner_Jackpot) {
			var distance = partSpinnerWidth_Jackpot * 12;
			distance += Math.floor(partSpinnerWidth_Jackpot / 2);

			distance += (0.1 * (new Date().getTime() - idleTimeSpinner_Jackpot)) % (partSpinnerWidth_Jackpot * 25);

			lastSpinner_Jackpot = distance;
			initializingSpinner_Jackpot();
		}
	}, 1);
}

function jackpotGame_addHistory(history) {
	var DIV = '<div class="jackpot_historyitem fade_center bg-light flex column gap-1 rounded-0 p-1">';
	DIV += '<div class="flex justify-between items-center gap-2 p-2" style="background: ' + history.bets[history.winner].color + '40;">';
	DIV += '<div class="text-bold">' + history.bets[history.winner].user.name + ' won the pot valued at ' + getFormatAmountString(history.amount) + ' coins with a chance of ' + history.chance.toFixed(2) + '%</div>';
	DIV += "<div class='bg-dark pt-1 pb-1 pr-2 pl-2 rounded-0 pointer text-bold fair-results' data-fair=' " + JSON.stringify(history.game) + " '>Provably Fair</div>";
	DIV += '</div>';

	DIV += '<div class="jackpot-grid-bets bg-light rounded-0" id="jackpot_betlist">';
	history.bets.forEach(function (item) {
		DIV += '<div class="flex items-center justify-between row gap-1 bg-dark p-2 rounded-0" style="border-left: solid 4px ' + item.color + ';">';
		DIV += '<div class="flex items-center gap-1 overflow-h p-1">';
		DIV += createAvatarField(item.user, 'small', '');

		DIV += '<div class="flex column items-start justify-center width-full ellipsis">';
		DIV += '<div class="font-8 text-left width-full ellipsis">' + item.user.name + '</div>';
		DIV += '<div class="font-6 text-gray">Tickets: ' + item.tickets.min + ' - ' + item.tickets.max + '</div>';
		DIV += '</div>';
		DIV += '</div>';

		DIV += '<div class="flex items-center"><div class="coins mr-1"></div><span>' + getFormatAmountString(item.amount) + '</span></div>';
		DIV += '</div>';
	});
	DIV += '</div>';
	DIV += '</div>';

	$('#jackpot_histories').prepend(DIV);

	while ($('#jackpot_histories .jackpot_historyitem').length > 5) $('#jackpot_histories .jackpot_historyitem').last().remove();
}

$(document).ready(function () {
	idleAnimationSpinner_Jackpot();

	$(window).resize(function () {
		initializingSpinner_Jackpot();
	});

	$(document).on('click', '#jackpot_bet', function () {
		$(this).addClass('disabled');

		var amount = $('#betamount_jackpot').val();

		send_request_socket({
			'type': 'jackpot',
			'command': 'bet',
			'amount': amount
		});
	});
});

/* END JACKPOT */


/* UNBOX */

var spinnerWidth_Unbox = 0;
var lastSpinner_Unbox = 0;
var timeSpinner_Unbox = 0;
var viewSpinner_Unbox = 0;
var beginTimeSpinner_Unbox = 0;
var movingSpinner_Unbox = false;
var durationSpinner_Unbox = 8;

var partSpinnerWidth_Unbox = 150;

$(document).ready(function () {
	$(document).on('click', '#unbox_test', function () {
		var id = $(this).attr('data-id');

		$('#unbox_test').addClass('disabled');
		$('#unbox_open').addClass('disabled');

		send_request_socket({
			'type': 'unbox',
			'command': 'test',
			'id': PATHS[1]
		});
	});

	$(document).on('click', '#unbox_open', function () {
		var id = $(this).attr('data-id');

		$('#unbox_test').addClass('disabled');
		$('#unbox_open').addClass('disabled');

		send_request_socket({
			'type': 'unbox',
			'command': 'open',
			'id': PATHS[1]
		});
	});

	$(window).resize(function () {
		initializingSpinner_Unbox();
	});
});

function renderSpinner_Unbox() {
	var time = new Date().getTime() - beginTimeSpinner_Unbox;
	if (time > timeSpinner_Unbox) time = timeSpinner_Unbox;

	var deg = viewSpinner_Unbox * (Math.pow((0.99 + 0.001 * durationSpinner_Unbox), time) - 1) / Math.log((0.99 + 0.001 * durationSpinner_Unbox));

	rotateSpinner_Unbox(deg);

	if (time < timeSpinner_Unbox) {
		setTimeout(function () {
			renderSpinner_Unbox();
		}, 1);
	} else {
		lastSpinner_Unbox = deg;
		movingSpinner_Unbox = false;
	}
}

function rotateSpinner_Unbox(offset) {
	if (offset > 0) offset = -(offset - spinnerWidth_Unbox / 2);

	$('#unbox_spinner').css('transform', 'translate3d(' + offset + 'px, 0px, 0px)');
}

function initializingSpinner_Unbox() {
	spinnerWidth_Unbox = $('#unbox_case').width();

	if (!movingSpinner_Unbox) rotateSpinner_Unbox(lastSpinner_Unbox);
}

function startSpinner_Unbox() {
	initializingSpinner_Unbox();

	var distance = partSpinnerWidth_Unbox * 99;
	distance += Math.floor(Math.random() * partSpinnerWidth_Unbox);

	beginTimeSpinner_Unbox = new Date().getTime();
	viewSpinner_Unbox = 0.01 - distance * Math.log((0.99 + 0.001 * durationSpinner_Unbox));
	timeSpinner_Unbox = (Math.log(0.01) - Math.log(viewSpinner_Unbox)) / Math.log((0.99 + 0.001 * durationSpinner_Unbox));
	movingSpinner_Unbox = true;

	renderSpinner_Unbox();
}

function unboxGame_openCase(items) {
	play_sound(audio_unbox_rolling);

	$('#unbox_spinner').css('transform', 'translate3d(0px, 0px, 0px)');

	$('#unbox_field').empty();

	items.forEach(function (item) {
		var ITEM = '<div class="reel-item flex justify-center items-center">';
		ITEM += unboxGame_generateItem(item);
		ITEM += '</div>';

		$('#unbox_field').append(ITEM);
	});

	startSpinner_Unbox();
}

function unboxGame_addCase(unbox) {
	var DIV = '<a href="' + ROOT + 'unbox/' + unbox.id + '">';
	DIV += '<div class="unbox-case bg-dark b-m2 rounded-1">';
	DIV += '<div class="unbox-image width-full height-full flex justify-center items-center">';
		DIV += '<img class="transition-5" src="' + ROOT + 'template/img/cases/' + unbox.id + '.png">';
	DIV += '</div>';

	DIV += '<div class="unbox-case-name width-full flex column justify-end items-center pt-3">';
	DIV += '<div class="text-bold font-9">' + unbox.name + '</div>';
	DIV += '<div class="font-8"><div class="coins mr-1"></div>' + getFormatAmountString(unbox.price) + '</div>';
	DIV += '</div>';
	DIV += '</div>';
	DIV += '</a>';

	$('#unboxing_list_cases').append(DIV);
}

function unboxGame_showCase(items, unbox, spinner) {
	$('#unbox_spenner').css('transform', 'translate3d(0px, 0px, 0px)');

	$('#unboxing_name').text(unbox.name);
	$('#unboxing_price').text(getFormatAmountString(unbox.price));

	$('#unbox_list').empty();
	items.forEach(function (item) {
		var ITEM = unboxGame_generateItem(item);

		$('#unbox_list').append(ITEM);
	});

	$('#unbox_field').empty();
	spinner.forEach(function (item) {
		var ITEM = '<div class="reel-item flex justify-center items-center">';
		ITEM += unboxGame_generateItem(item);
		ITEM += '</div>';

		$('#unbox_field').append(ITEM);
	});
}

function unboxGame_generateItem(item) {
	var name = getInfosByItemName(item.name);

	var ITEM = '<div class="listing-item flex column">';
	ITEM += '<div class="listing-slot rounded-0" style="border-bottom: solid 3px ' + item.color + ' !important;">';
	if (name.exterior != null) ITEM += '<div class="item-quality text-left">' + name.exterior + '</div>';

	ITEM += '<div class="item-chance text-right">' + roundedToFixed(item.chance, 2).toFixed(2) + '%</div>';

	ITEM += '<div class="item-image-content flex items-center justify-center p-2">';
	ITEM += '<img class="item-image transition-5" src="' + item.image + '">';
	ITEM += '</div>';

	ITEM += '<div class="item-name-content text-left">';
	if (name.brand != null) ITEM += '<div class="item-brand ellipsis">' + name.brand + '</div>';
	if (name.name != null) ITEM += '<div class="item-name ellipsis">' + name.name + '</div>';
	ITEM += '</div>';

	ITEM += '<div class="item-price text-left"><div class="coins mr-1"></div>' + getFormatAmountString(item.price) + '</div>';

	if (item.tickets !== undefined) ITEM += '<div class="item-tickets text-right">' + item.tickets.min + ' - ' + item.tickets.max + '</div>';
	ITEM += '</div>';
	ITEM += '</div>';

	return ITEM;
}

function unboxGame_addHistory(history) {
	$('#unbox_history .history_message').remove();

	var name = getInfosByItemName(history.winning.name);

	var DIV = '<div class="history-container medium success rounded-1 p-5 fade_center" style="border: 2px solid ' + history.winning.color + '80; background: linear-gradient(to top, ' + history.winning.color + '80 0%, var(--site-color-bg-dark-transparent) 100%);">';
	DIV += '<a href="' + ROOT + 'unbox/' + history.unbox.id + '" target="_blank">';
	DIV += '<div class="history-content unbox flex justify-center items-center">';
	DIV += '<div class="unbox transition-5">';
	DIV += '<img class="image" src="' + history.winning.image + '">';

	if (name.exterior != null) DIV += '<div class="exterior text-bold text-left pl-1">' + name.exterior + '</div>';
	DIV += '<div class="chance text-bold text-right pr-1">' + parseFloat(history.winning.chance).toFixed(2) + '%</div>';

	DIV += '<div class="name text-left pl-1">';
	if (name.brand != null) DIV += '<div class="text-bold">' + name.brand + '</div>';
	if (name.name != null) DIV += '<div>' + name.name + '</div>';
	DIV += '</div>';

	DIV += '<div class="price text-right pr-1"><div class="coins-mini mr-1"></div>' + getFormatAmountString(history.winning.price) + '</div>';
	DIV += '</div>';

	DIV += '<div class="case transition-5">';
	DIV += '<img class="image" src="' + ROOT + 'template/img/cases/' + history.unbox.id + '.png?v=' + time() + '">';

	DIV += '<div class="name text-bold">' + history.unbox.name + '</div>';

	DIV += '<div class="price"><div class="coins mr-1"></div>' + getFormatAmountString(history.unbox.price) + '</div>';

	DIV += '<div class="absolute top-0 bottom-0 left-0 right-0 p-1 flex items-center justify-center height-full gap-1">';
	DIV += createAvatarField(history.user, 'medium', '');
	DIV += '<div class="text-left ellipsis">' + history.user.name + '</div>';
	DIV += '</div>';
	DIV += '</div>';
	DIV += '</div>';
	DIV += '</a>';
	DIV += '</div>';

	$('#unbox_history').prepend(DIV);

	while ($('#unbox_history .history-container').length > 20) $('#unbox_history .history-container').last().remove();
}

/* END UNBOX */

/*  ROULETTE  */

var rouletteGame_last100Games = [];

var rouletteGame_data = {
	'red': {
		higher_bet: 0,
		total_users: 0,
		total_amount: 0,
		total_my_amount: 0,
		users_amount: {}
	},
	'purple': {
		higher_bet: 0,
		total_users: 0,
		total_amount: 0,
		total_my_amount: 0,
		users_amount: {}
	},
	'black': {
		higher_bet: 0,
		total_users: 0,
		total_amount: 0,
		total_my_amount: 0,
		users_amount: {}
	}
}

var spinnerWidth_Roulette = 0;
var lastSpinner_Roulette = 0;
var timeSpinner_Roulette = 0;
var viewSpinner_Roulette = 0;
var beginTimeSpinner_Roulette = 0;
var movingSpinner_Roulette = false;
var durationSpinner_Roulette = 9;

var partSpinnerWidth_Roulette = 60;

function rouletteGame_finish(roll) {
	$('#roulette_timer').text('ROLLED ' + roll.roll + '!');

	play_sound(audio_roulette_end);
	rouletteGame_addHistory(roll);

	if (rouletteGame_last100Games.length >= 100) rouletteGame_last100Games.shift();
	rouletteGame_last100Games.push({ roll: roll.roll, color: roll.color });

	var rolls100 = {
		'red': 0,
		'purple': 0,
		'black': 0
	};
	rouletteGame_last100Games.forEach(function (last) {
		rolls100[last.color]++;
	});
	$('#roulette_history').removeClass('hidden');
	$('#roulette_hundred_red').text(rolls100['red']);
	$('#roulette_hundred_purple').text(rolls100['purple']);
	$('#roulette_hundred_black').text(rolls100['black']);

	var cats = [
		['purple', 14],
		['red', 2],
		['black', 2]
	];
	
	for (var i = 0; i < cats.length; i++) {
		var $mytotal = $('#roulette_panel_' + cats[i][0] + ' .roulette-mytotal');
		var $total = $('#roulette_panel_' + cats[i][0] + ' .roulette-betstotal');

		if (roll.color == cats[i][0]) {
			$total.countToFloat(rouletteGame_data[cats[i][0]].total_amount * cats[i][1]);

			$mytotal.countToFloat(rouletteGame_data[cats[i][0]].total_my_amount * cats[i][1]);
			
			if(rouletteGame_data[cats[i][0]].total_my_amount > 0) $('#roulette_panel_' + cats[i][0] + ' .roulette-bet-mytotal').addClass('text-success');
		} else {
			$total.countToFloat(-rouletteGame_data[cats[i][0]].total_amount);

			$mytotal.countToFloat(-rouletteGame_data[cats[i][0]].total_my_amount);
		}
	}
	
	$('#roulette_panel_' + roll.color + ' .roulette-bet-betstotal').addClass('text-success');
	$('#roulette_panel_' + roll.color + ' .roulette-betslist').addClass('text-success');

	setTimeout(function () {
		initializingSpinner_Roulette(roll);
	}, 1000);

	setTimeout(function () {
		$('.roulette-mytotal,.roulette-betstotal').text(getFormatAmountString(0));
		$('.roulette-betscount').text(0);
		$('.roulette-betslist').empty();

		$('.roulette-highname').text('Nothing');
		$('.roulette-hightotal').text(getFormatAmountString(0));
		$('.roulette-highicon').attr('src', 'https://betdls.com/favicon-16x16.png?v=1670521522');
	
		$('#roulette_panel_' + roll.color + ' .roulette-bet-mytotal').removeClass('text-success');
	
		$('#roulette_panel_' + roll.color + ' .roulette-bet-betstotal').removeClass('text-success');
		$('#roulette_panel_' + roll.color + ' .roulette-betslist').removeClass('text-success');
		
		rouletteGame_data = {
			'red': {
				higher_bet: 0,
				total_users: 0,
				total_amount: 0,
				total_my_amount: 0,
				users_amount: {}
			},
			'purple': {
				higher_bet: 0,
				total_users: 0,
				total_amount: 0,
				total_my_amount: 0,
				users_amount: {}
			},
			'black': {
				higher_bet: 0,
				total_users: 0,
				total_amount: 0,
				total_my_amount: 0,
				users_amount: {}
			}
		}
	}, 2000);
}

function rouletteGame_addHistory(roll) {
	var count = $('#roulette_rolls .pick-ball').length;
	if (count >= 10) $('#roulette_rolls .pick-ball').first().remove();

	$('#roulette_rolls').append('<div class="pick-ball small pick-ball-' + roll.color + '"><div class="width-full height-full text-shadow flex items-center justify-center">' + roll.roll + '</div></div>');
}

function rouletteGame_highBet(bet) {
	if (bet.amount > rouletteGame_data[bet.color].higher_bet) {
		rouletteGame_data[bet.color].higher_bet = bet.amount;

		$('#roulette_panel_' + bet.color + ' .roulette-highname').text(bet.user.name);
		$('#roulette_panel_' + bet.color + ' .roulette-highicon').attr('src', bet.user.avatar);
		$('#roulette_panel_' + bet.color + ' .roulette-hightotal').text(getFormatAmountString(bet.amount));
	}
}

function rouletteGame_addBet(bet) {
	if (rouletteGame_data[bet.color].users_amount[bet.user.userid] === undefined) {
		rouletteGame_data[bet.color].users_amount[bet.user.userid] = 0;
		rouletteGame_data[bet.color].total_users++;

		$('#roulette_panel_' + bet.color + ' .roulette-betscount').text(rouletteGame_data[bet.color].total_users);
	}

	rouletteGame_data[bet.color].users_amount[bet.user.userid] += parseFloat(bet.amount);

	rouletteGame_data[bet.color].total_amount += parseFloat(bet.amount);
	$('#roulette_panel_' + bet.color + ' .roulette-betstotal').countToFloat(rouletteGame_data[bet.color].total_amount);

	if (USER == bet.user.userid) {
		rouletteGame_data[bet.color].total_my_amount += parseFloat(bet.amount);
		$('#roulette_panel_' + bet.color + ' .roulette-mytotal').countToFloat(rouletteGame_data[bet.color].total_my_amount);
	}

	if (getFormatAmount(rouletteGame_data[bet.color].users_amount[bet.user.userid]) < 0.1) return;

	$('#roulette_panel_' + bet.color + ' .roulette-betslist .roulette-betitem[data-userid="' + bet.user.userid + '"]').remove();

	var DIV = '<div class="roulette-betitem bg-light-transparent flex items-center justify-between p-2 pr-2 p-1" data-userid="' + bet.user.userid + '" data-amount="' + rouletteGame_data[bet.color].users_amount[bet.user.userid] + '">';
	DIV += '<div class="flex items-center gap-1">';
	DIV += createAvatarField(bet.user, 'small', '');
	DIV += '<div class="text-left width-full ellipsis">' + bet.user.name + '</div>';
	DIV += '</div>';

	DIV += '<div class="flex items-center">' + getFormatAmountString(rouletteGame_data[bet.color].users_amount[bet.user.userid]) + '</div>';
	DIV += '</div>';

	$('#roulette_panel_' + bet.color + ' .roulette-betslist').prepend(DIV);
	$('#roulette_panel_' + bet.color + ' .roulette-betslist .roulette-betitem[data-userid="' + bet.user.userid + '"]').slideUp(0).slideDown('fast');

	rouletteGame_highBet({
		user: bet.user,
		amount: rouletteGame_data[bet.color].users_amount[bet.user.userid],
		color: bet.color
	});

	try {
		tinysort('#roulette_panel_red>.roulette-betslist>.roulette-bet-item', {
			data: 'amount',
			order: 'desc'
		});
	} catch (e) { }
	try {
		tinysort('#roulette_panel_purple>.roulette-betslist>.roulette-bet-item', {
			data: 'amount',
			order: 'desc'
		});
	} catch (e) { }
	try {
		tinysort('#roulette_panel_black>.roulette-betslist>.roulette-bet-item', {
			data: 'amount',
			order: 'desc'
		});
	} catch (e) { }
}

function renderSpinner_Roulette() {
	var time = new Date().getTime() - beginTimeSpinner_Roulette;
	if (time > timeSpinner_Roulette) time = timeSpinner_Roulette;

	var deg = viewSpinner_Roulette * (Math.pow((0.99 + 0.001 * durationSpinner_Roulette), time) - 1) / Math.log((0.99 + 0.001 * durationSpinner_Roulette));

	rotateSpinner_Roulette(deg);

	if (time < timeSpinner_Roulette) {
		setTimeout(function () {
			renderSpinner_Roulette();
		}, 1);
	} else {
		lastSpinner_Roulette = deg;
		movingSpinner_Roulette = false;
	}
}

function rotateSpinner_Roulette(offset) {
	offset = -((offset - spinnerWidth_Roulette / 2) % (partSpinnerWidth_Roulette * 15)) - (partSpinnerWidth_Roulette * 15);
	$('#roulette_spinner').css('transform', 'translate3d(' + offset + 'px, 0px, 0px)');
}

function initializingSpinner_Roulette(roll) {
	spinnerWidth_Roulette = $('#roulette_case').width();

	if (!movingSpinner_Roulette) {
		if (roll === undefined) {
			rotateSpinner_Roulette(lastSpinner_Roulette);
		} else {
			var order = [1, 14, 2, 13, 3, 12, 4, 0, 11, 5, 10, 6, 9, 7, 8];
			var index = order.indexOf(roll.roll);

			var distance = index * partSpinnerWidth_Roulette;
			distance += (partSpinnerWidth_Roulette * 15) * 5;
			distance += Math.floor(roll.progress * partSpinnerWidth_Roulette);

			lastSpinner_Roulette = distance;

			rotateSpinner_Roulette(lastSpinner_Roulette);
		}
	}
}

function startSpinner_Roulette(roll, cooldown) {
	initializingSpinner_Roulette();

	var order = [1, 14, 2, 13, 3, 12, 4, 0, 11, 5, 10, 6, 9, 7, 8];
	var index = order.indexOf(roll.roll);

	var distance = index * partSpinnerWidth_Roulette;
	distance += (partSpinnerWidth_Roulette * 15) * 5;
	distance += Math.floor(roll.progress * partSpinnerWidth_Roulette);

	beginTimeSpinner_Roulette = new Date().getTime() - cooldown * 1000;
	viewSpinner_Roulette = 0.01 - distance * Math.log((0.99 + 0.001 * durationSpinner_Roulette));
	timeSpinner_Roulette = (Math.log(0.01) - Math.log(viewSpinner_Roulette)) / Math.log((0.99 + 0.001 * durationSpinner_Roulette));
	movingSpinner_Roulette = true;

	renderSpinner_Roulette();

	setTimeout(function () {
		rouletteGame_finish(roll);
	}, timeSpinner_Roulette - cooldown * 1000);
}

function rouletteGame_timer(time) {
	$('.roulette-bet').removeClass('disabled');

	$('#roulette_counter').animate({
		'width': '0'
	}, {
		'duration': time * 1000,
		'easing': 'linear',
		'progress': function (animation, progress, msRemaining) {
			var remaing = (msRemaining / 1000).toFixed(2);
			$('#roulette_timer').text('ROLLING IN ' + remaing);

			var las = remaing * 100 / 20;
			$('#roulette_counter').css('width', las + '%');
		},
		'complete': function () {
			$('#roulette_timer').text('CONFIRMING ALL BETS...');
		}
	});
}

$(document).ready(function () {
	$(window).resize(function () {
		initializingSpinner_Roulette();
	});

	$('.roulette-bet').on('click', function () {
		$(this).addClass('disabled');

		var amount = $('#betamount_roulette').val();
		var color = $(this).data("color");

		send_request_socket({
			'type': 'roulette',
			'command': 'bet',
			'amount': amount,
			'color': color
		});
	});
});

/* END ROULETTE */

/* CRASH */

function crashGame_resize() {
	var width = $('#crash_canvas').parent().width();
	canvas.width = width;

	if (width > 750) width = 750;
	canvas.height = width / 2;

	$('.crash-rocket-content').css('height', width / 200 * 40);
}

function crashGame_addGame(bet) {
	$('#crash_betlist .history_message').remove();

	var DIV = '<div class="table-row crash_betitem text-color" data-id="' + bet.id + '">';
	DIV += '<div class="table-column text-left">';
	DIV += '<div class="flex items-center gap-1">';
	DIV += createAvatarField(bet.user, 'small', '');
	DIV += '<div class="text-left width-full ellipsis">' + bet.user.name + '</div>';
	DIV += '</div>';
	DIV += '</div>';
	DIV += '<div class="table-column text-left"><span class="at">-</span></div>';
	DIV += '<div class="table-column text-left"><span class="total">' + getFormatAmountString(bet.amount) + '</span></div>';
	DIV += '<div class="table-column text-left"><span class="profit">-</span></div>';
	DIV += '</div>';

	$('#crash_betlist').prepend(DIV);
	$('#crash_betlist .crash_betitem[data-id="' + bet.id + '"]').slideUp(0).slideDown('fast');
}

function crashGame_addHistory(crash) {
	var class_pick = (crash <= 1.79) ? 'low' : (crash >= 2.00) ? 'high' : 'medium';

	$('#crash_history').prepend('<div class="crash-roll ' + class_pick + '">' + roundedToFixed(crash, 2).toFixed(2) + 'x</div>');

	while ($('#crash_history .crash-roll').length > 50) $('#crash_history .crash-roll').last().remove();
}

function crashGame_editBet(bet) {
	$('#crash_betlist .crash_betitem[data-id="' + bet.id + '"] .at').text(roundedToFixed(bet.cashout, 2).toFixed(2));
	$('#crash_betlist .crash_betitem[data-id="' + bet.id + '"] .profit').text(getFormatAmountString(bet.profit));
	$('#crash_betlist .crash_betitem[data-id="' + bet.id + '"]').removeClass('text-color').addClass('text-success');
}

$(document).ready(function () {
	$('#crash_bet').on('click', function () {
		var amount = $('#betamount_crash').val();
		var auto = parseInt($('#betauto_crash').val() * 100);

		send_request_socket({
			'type': 'crash',
			'command': 'bet',
			'amount': amount,
			'auto': auto
		});
	});

	$('#crash_cashout').on('click', function () {
		send_request_socket({
			'type': 'crash',
			'command': 'cashout'
		});
	});
});

/* END CRASH */

/* COINFLIP */

var coinflipGame_coin = 1;

function coinflipGame_addCoinFlip(coinflip) {
	var DIV = coinflipGame_generateBet(coinflip, 0);

	var $field = $('#coinflip_betlist .coinflip-game:not(.active)').first();
	$field.html(DIV).addClass('active');

	var last_game = $('#coinflip_betlist .coinflip-game.active').last().index() + 1;
	for (var i = 0; i < (last_game % 5 == 0) * 5; i++) {
		$('#coinflip_betlist').append('<div class="coinflip-game bg-dark rounded-1 b-l2"></div>');
	}
}

function coinflipGame_editCoinFlip(coinflip, status) {
	var DIV = coinflipGame_generateBet(coinflip, status);

	var $field = $('#coinflip_betlist .coinflip-game .coinflip_betitem[data-id="' + coinflip.id + '"]').parent();
	$field.html(DIV)
}

function coinflipGame_generateBet(coinflip, status) {
	var DIV = '<div class="coinflip_betitem bg-light-transparent relative height-full width-full flex justify-between p-2" data-id="' + coinflip.id + '">';
	var class_player1 = '';
	var class_player2 = '';

	if (status == 4) {
		class_player1 = (coinflip.data.winner == 2) ? 'active' : '';
		class_player2 = (coinflip.data.winner == 1) ? 'active' : '';
	}

	DIV += '<div class="coinflip-player ' + class_player1 + ' width-5 height-full bg-dark rounded-1 p-1">';
	DIV += '<div class="flex column justify-between items-center height-full">';
	DIV += '<div class="flex column items-center justify-center height-full width-full gap-2">';
	if (coinflip.creator == 1 || status > 0) {
		DIV += createAvatarField(coinflip.player1, 'large', '<div class="level sop-large-left flex justify-center items-center b-d2 bg-dark rounded-full"><img src="' + ROOT + 'template/img/coinflip/coin1.png"></div>');

		DIV += '<div class="width-full ellipsis">' + coinflip.player1.name + '</div>';
	} else {
		if(coinflip.player2.userid == USER){
			DIV += '<div class="relative">';
				DIV += '<button class="site-button purple width-full" id="coinflip_cancel" data-id="' + coinflip.id + '">CANCEL</button>';
			DIV += '</div>';
		} else {
			DIV += '<div class="relative">';
				DIV += '<button class="site-button purple width-full" id="coinflip_join" data-id="' + coinflip.id + '">JOIN GAME</button>';
				DIV += '<div class="sop-large-left flex justify-center items-center b-m2 bg-dark rounded-full"><img src="' + ROOT + 'template/img/coinflip/coin1.png"></div>';
			DIV += '</div>';
		}
	}
	DIV += '</div>';

	DIV += '<div class="bg-light rounded-1 b-l2 pl-2 pr-2 flex items-center justify-center">';
	DIV += '<div class="coins mr-1"></div>';
	DIV += '<span class="">' + getFormatAmountString(coinflip.amount) + '</span>';
	DIV += '</div>';
	DIV += '</div>';
	DIV += '</div>';

	DIV += '<div class="flex justify-center items-center relative p-2">';
	if (status == 0) {
		DIV += '<div class="text-bold font-10">VS</div>';
	} else if (status == 1) {
		DIV += '<div class="b-d2 bg-dark rounded-full flex justify-center items-center text-bold p-4 font-11">';
		DIV += '<div class="absolute" id="coinflip_timer_' + coinflip.id + '">' + coinflip.data.time + '</div>';

		DIV += '<script>';
		DIV += 'var coinflip_timer_' + coinflip.id + ' = ' + coinflip.data.time + ';';

		DIV += 'clearInterval(coinflip_interval_' + coinflip.id + ');';
		DIV += 'var coinflip_interval_' + coinflip.id + ' = setInterval(function(){';
		DIV += 'coinflip_timer_' + coinflip.id + '--;';

		DIV += '$("#coinflip_timer_' + coinflip.id + '").text(coinflip_timer_' + coinflip.id + ');';

		DIV += 'if(coinflip_timer_' + coinflip.id + ' <= 0) clearInterval(coinflip_interval_' + coinflip.id + ');';
		DIV += '}, 1000);';
		DIV += '</script>';
		DIV += '</div>';
	} else if (status == 2) {
		DIV += '<div class="text-bold font-10">EOS</div>';
	} else if (status == 3) {
		DIV += '<div class="flex justify-center items-center relative">';
		DIV += '<div class="coinflip-coin coinflip-coin-animation-' + coinflip.data.winner + '">';
		DIV += '<div class="front absolute top-0 bottom-0 left-0 right-0"></div>';
		DIV += '<div class="back absolute top-0 bottom-0 left-0 right-0"></div>';
		DIV += '</div>';
		DIV += '</div>';
	} else if (status == 4) {
		DIV += '<div class="flex justify-center items-center relative">';
		DIV += '<div class="coinflip-pick-' + coinflip.data.winner + '"></div>';
		DIV += '</div>';
	}

	DIV += "<div class='coinflip-fair pointer absolute bottom-0 font-5 fair-results' data-fair='" + JSON.stringify(coinflip.data.game) + "'>Provably fair</div>";
	DIV += '</div>';

	DIV += '<div class="coinflip-player ' + class_player2 + ' width-5 height-full bg-dark rounded-1 p-1">';
	DIV += '<div class="flex column justify-between items-center height-full">';
	DIV += '<div class="flex column items-center justify-center height-full width-full gap-2">';
	if (coinflip.creator == 2 || status > 0) {
		DIV += createAvatarField(coinflip.player2, 'large', '<div class="level sop-large-left flex justify-center items-center b-d2 bg-dark rounded-full"><img src="' + ROOT + 'template/img/coinflip/coin2.png"></div>');

		DIV += '<div class="width-full ellipsis">' + coinflip.player2.name + '</div>';
	} else {
		if(coinflip.player1.userid == USER){
			DIV += '<div class="relative">';
				DIV += '<button class="site-button purple width-full" id="coinflip_cancel" data-id="' + coinflip.id + '">CANCEL</button>';
			DIV += '</div>';
		} else {
			DIV += '<div class="relative">';
				DIV += '<button class="site-button purple width-full" id="coinflip_join" data-id="' + coinflip.id + '">JOIN GAME</button>';
				DIV += '<div class="sop-large-left flex justify-center items-center b-m2 bg-dark rounded-full"><img src="' + ROOT + 'template/img/coinflip/coin2.png"></div>';
			DIV += '</div>';
		}
	}
	DIV += '</div>';

	DIV += '<div class="bg-light rounded-1 b-l2 pl-2 pr-2 flex items-center justify-center">';
	DIV += '<div class="coins mr-1"></div>';
	DIV += '<span class="">' + getFormatAmountString(coinflip.amount) + '</span>';
	DIV += '</div>';
	DIV += '</div>';
	DIV += '</div>';
	DIV += '</div>';

	return DIV;
}

function coinflipGame_getWinner(percentage) {
	var chanceSeparator = 50;

	if (parseFloat(percentage) <= chanceSeparator) return 1;
	else return 2;
}

$(document).ready(function () {
	$(document).on('click', '#coinflip_join', function () {
		$(this).addClass('disabled');

		var id = $(this).attr('data-id');

		send_request_socket({
			type: 'coinflip',
			command: 'join',
			id: id
		});
	});

	$(document).on('click', '#coinflip_cancel', function () {
		$(this).addClass('disabled');

		var id = $(this).attr('data-id');

		send_request_socket({
			type: 'coinflip',
			command: 'cancel',
			id: id
		});
	});

	$(document).on('click', '.coinflip-select', function () {
		var coin = $(this).data('coin');

		if (coinflipGame_coin != coin) {
			coinflipGame_coin = coin;
			$('.coinflip-select').removeClass('active');
			$(this).addClass('active');
		}
	});

	$('#coinflip_create').click(function () {
		$(this).addClass('disabled');

		var amount = $('#betamount_coinflip').val();

		send_request_socket({
			type: 'coinflip',
			command: 'create',
			amount: amount,
			coin: coinflipGame_coin
		});
	});
});

/* END COINFLIP */

/* OFFERS */

/* DLS */

$(document).ready(function () {
	$(document).on('click', '#save_dls_growid', function (e) {
		var growid = $('#dls_growid').val();
		
		requestRecaptcha(function (render) {
			send_request_socket({
				type: 'dl',
				command: 'growid',
				growid: growid,
				recaptcha: render
			});
		});
	});
	
	$(document).on('click', '#start_dls_deposit', function (e) {
		requestRecaptcha(function (render) {
			send_request_socket({
				type: 'dl',
				command: 'deposit',
				recaptcha: render
			});
		});
	});
});

/* END DLS */

function offers_calculateCurrencyValue(type, currency) {
	var $input_amount = $('.currency-panel #currency_coin_' + type.toLowerCase());
	var value = $input_amount.val();

	var amount = value;
	amount = getNumberFromString(amount);

	if (type == 'from') {
		$('.currency-panel #currency_coin_from').val(value);

		$('.currency-panel #currency_coin_to').val((getFormatAmount(amount) / offers_currencyValues[currency]).toFixed(8));
	} else if (type == 'to') {
		$('.currency-panel #currency_coin_to').val(value);

		$('.currency-panel #currency_coin_from').val(getFormatAmountString(offers_currencyValues[currency] * amount));
	}

	var types = {
		from: 'to',
		to: 'from'
	};

	var $input_check = $('.currency-panel #currency_coin_' + types[type.toLowerCase()]);

	changeInputFieldLabel($input_check.parent().parent().parent());
}

function offers_calculateCurrencyValues(type, currency) {
	var $input_amount = $('.currency-panel #currency_coin_' + type.toLowerCase());
	var value = $input_amount.val();

	var amount = value;
	amount = getNumberFromString(amount);

	if (type == 'from') {
		$('.currency-panel #currency_coin_from').val(value);

		$('.currency-panel #currency_coin_to').val((getFormatAmount(amount) / 2.9).toFixed(2));
	} else if (type == 'to') {
		$('.currency-panel #currency_coin_to').val(value);

		$('.currency-panel #currency_coin_from').val(getFormatAmountString(2.9 * amount));
	}

	var types = {
		from: 'to',
		to: 'from'
	};

	var $input_check = $('.currency-panel #currency_coin_' + types[type.toLowerCase()]);

	changeInputFieldLabel($input_check.parent().parent().parent());
}



var dl_withdraw_method = 'trade';

var dl_withdraw_automatically_amount = 5;
var dl_license_amount = 5;

$(document).ready(function () {
	$(document).on("click", ".dl_select_amount", function (e) {
		var amount = parseInt($(this).attr('data-amount'));
		
		dl_withdraw_automatically_amount = amount;
		
		$('.dl_select_amount').removeClass('active');
		$(this).addClass('active');
	});
	
	$(document).on("click", ".dl_license_amount", function (e) {
		var amount = parseInt($(this).attr('data-amount'));
		
		dl_license_amount = amount;
		
		$('.dl_license_amount').removeClass('active');
		$(this).addClass('active');
	});
	
	$(document).on("click", ".dl_withdraw_automatically", function (e) {
		requestRecaptcha(function (render) {
			send_request_socket({
				type: 'dl',
				command: 'withdraw_automatically',
				amount: dl_withdraw_automatically_amount,
				recaptcha: render
			});
		});
	});
	
	$(document).on("click", "#admin_dl_license_set", function (e) {
		var license = $('#admin_dl_license_license').val();
		
		confirm_action(function (confirmed) {
			if (!confirmed) return;
			
			send_request_socket({
				type: 'dl',
				command: 'license',
				license: license,
				amount: dl_license_amount
			});
		});
	});
	
	
	
	$(document).on("click", ".dl_withdraw_method", function (e) {
		var method = $(this).attr('data-method');
		
		dl_withdraw_method = method;
		
		$('.dl_withdraw_method').removeClass('active');
		$(this).addClass('active');
	});
	
	$(document).on("click", ".dl_withdraw_manually", function (e) {
		var world = $('#withdraw_world').val();
		var growid = $('#withdraw_growid').val();
		var amount = $('#withdraw_amount').val();

		requestRecaptcha(function (render) {
			send_request_socket({
				type: 'dl',
				command: 'withdraw_manually',
				world: world,
				growid: growid,
				method: dl_withdraw_method,
				amount: amount,
				recaptcha: render
			});
		});
	});
	
	$(document).on("click", "#deposit_grow", function (e) {
		e.preventDefault();

		var growid = $('#growid1').val();

		requestRecaptcha(function (render) {
			send_request_socket({
				type: 'grow',
				command: 'start',
				growid: growid,
				recaptcha: render
			});
		});
	});

	$(document).on("click", "#generate_address", function () {
		var currency = $(this).data('currency');

		requestRecaptcha(function (render) {
			send_request_socket({
				type: 'currency',
				command: 'generate_address',
				currency: currency,
				recaptcha: render
			});
		});
	});

	$(document).on("click", "#crypto_withdraw", function () {
		var currency = $(this).data('game').toLowerCase();
		var address = $('.currency-panel #currency_withdraw_address').val();
		var amount = $('.currency-panel #currency_coin_from').val();

		requestRecaptcha(function (render) {
			send_request_socket({
				type: 'currency',
				command: 'withdraw',
				currency: currency.toUpperCase(),
				amount: amount,
				address: address,
				recaptcha: render
			});
		});
	});
});

/* END OFFERS */

/* FAQ */

$(document).ready(function () {
	$(document).on('click', '.faq-open', function () {
		if ($(this).parent().parent().hasClass('active')) {
			$(this).parent().parent().removeClass('active');
		} else {
			$(this).parent().parent().addClass('active');
		}
	});
});

/* END FAQ */

/* SUPPORT */

$(document).ready(function () {
	$(document).on('click', '.support-ticket .title', function () {
		if (!$(this).parent().hasClass('active')) {
			$('.support-ticket').removeClass('active');
			$(this).parent().addClass('active');
		} else $(this).parent().removeClass('active');
	});

	$(document).on('click', '.support-open', function () {
		var status = $(this).data('status');

		$('.support-open').removeClass('active');
		$(this).addClass('active');

		if (status == 'all') {
			$('.support-content .support-ticket').removeClass('hidden');
		} else {
			$('.support-content .support-ticket').addClass('hidden');
			$('.support-content .support-ticket[data-status="' + status + '"]').removeClass('hidden');
		}
	});

	initializeSupportForm();
	function initializeSupportForm() {
		$('.form_support').on('submit', function (e) {
			e.preventDefault();

			$.ajax({
				url: $(this).attr('action'),
				type: $(this).attr('method'),
				data: $(this).serialize() + '&' + $(this).find('[type="submit"]:focus').attr('name'),
				success: function (data) {
					try {
						data = JSON.parse(data);

						if (data.success) {
							notify('success', data.message);

							$('#page_loader').load(' #page_content', function () {
								initializeInputFields();
								initializeDropdownFields();
								initializeSwitchFields();
								initializeSliderFields();

								initializeSupportForm();
							});
						} else {
							notify('error', data.error);
						}
					} catch (err) {
						notify('error', err.message);
					}
				},
				error: function (err) {
					notify('error', 'Error 500');
				}
			});
		});
	}

	$(document).on('click', '#open_tickets', function () {
		var id = $(this).data('id');

		if ($('.support-tickets[data-id="' + id + '"]').hasClass('hidden')) {
			$('.support-tickets[data-id="' + id + '"]').removeClass('hidden');
		} else {
			$('.support-tickets[data-id="' + id + '"]').addClass('hidden');
		}
	});

	$(document).on('change', '#type_ticket_support', function () {
		$('.support-content').removeClass('hidden');

		if ($(this).is(':checked')) {
			$('.support-content[data-type="closed"]').addClass('hidden');
		} else {
			$('.support-content[data-type="opened"]').addClass('hidden');
		}
	});
});

/* END SUPPORT */

/* FAIR */

$(document).ready(function () {
	$(document).on('click', '.fair-category .title', function () {
		if (!$(this).parent().hasClass('active')) {
			$('.fair-category').removeClass('active');
			$(this).parent().addClass('active');
		} else $(this).parent().removeClass('active');
	});

	$(document).on('click', '.fair-results', function () {
		var fair = JSON.parse($(this).attr('data-fair').toString());

		$('#fair_server_seed_hashed').text('-');
		$('#fair_server_seed').text('-');
		$('#fair_public_seed').text('-');
		$('#fair_nonce').text('-');
		$('#fair_block').text('-');
		$('#fair_block_link').attr('href', '');

		$('#fair_server_seed_hashed').attr('data-text', '');
		$('#fair_server_seed').attr('data-text', '');
		$('#fair_public_seed').attr('data-text', '');
		$('#fair_nonce').attr('data-text', '');

		if (fair.server_seed_hashed !== undefined) $('#fair_server_seed_hashed').text(fair.server_seed_hashed);
		if (fair.server_seed !== undefined) $('#fair_server_seed').text(fair.server_seed);
		if (fair.public_seed !== undefined) $('#fair_public_seed').text(fair.public_seed);
		if (fair.nonce !== undefined) $('#fair_nonce').text(fair.nonce);
		if (fair.block !== undefined) {
			$('#fair_block').text(fair.block);
			$('#fair_block_link').attr('href', 'https://eosflare.io/block/' + fair.block);
		}

		$('#fair_server_seed_hashed').attr('data-text', fair.server_seed_hashed);
		$('#fair_server_seed').attr('data-text', fair.server_seed);
		$('#fair_public_seed').attr('data-text', fair.public_seed);
		$('#fair_nonce').attr('data-text', fair.nonce);

		$('#modal_fair_round').modal('show');
	});

	$(document).on('click', '.fair-roulette-games', function () {
		var games = JSON.parse($(this).attr('data-games').toString());

		$('#modal_fair_games .fair-games').empty();

		games.forEach(function (item) {
			var DIV = '<div class="bg-light-transparent b-l2 rounded-0 flex column justify-center items-center gap-2">';
			DIV += '<div class="pick-ball large pick-ball-' + item.color + '"><div class="width-full height-full text-shadow flex items-center justify-center">' + item.roll + '</div></div>';
			DIV += '<div>Nonce: ' + item.nonce + '</div>';
			DIV += '</div>';

			$('#modal_fair_games .fair-games').prepend(DIV);
		});

		$('#modal_fair_games').modal('show');
	});

	$(document).on('click', '.fair-crash-games', function () {
		var games = JSON.parse($(this).attr('data-games').toString());

		$('#modal_fair_games .fair-games').empty();

		games.forEach(function (item) {
			var class_pick = (item.point <= 1.79) ? 'low' : (item.point >= 2.00) ? 'high' : 'medium';

			var DIV = '<div class="bg-light-transparent b-l2 rounded-0 flex column justify-center items-center gap-2">';
			DIV += '<div class="crash-roll ' + class_pick + '">' + roundedToFixed(item.point, 2).toFixed(2) + 'x</div>';
			DIV += '<div>Nonce: ' + item.nonce + '</div>';
			DIV += '</div>';

			$('#modal_fair_games .fair-games').prepend(DIV);
		});

		$('#modal_fair_games').modal('show');
	});
});

/* END FAIR */

function getInfosByItemName(name) {
	var infos = {
		brand: null,
		name: null,
		exterior: null
	}

	var stage1 = name.split(' | ');

	if (stage1.length > 0) {
		infos.brand = stage1[0];

		if (stage1.length > 1) {
			if (stage1[1].indexOf('(') >= 0 && stage1[1].indexOf(')') >= 0) {
				var stage2 = stage1[1].split(' (');
				infos.name = stage2[0];

				var stage3 = stage2[1].split(')');
				infos.exterior = stage3[0];
			} else infos.name = stage1[1];
		}
	}

	return infos;
}

function createLoader() {
	var DIV = '<div class="flex in-grid justify-center items-center width-full height-full history_message">';
	DIV += '<div class="loader">';
	DIV += '<div class="loader-part loader-part-1">';
	DIV += '<div class="loader-dot loader-dot-1"></div>';
	DIV += '<div class="loader-dot loader-dot-2"></div>';
	DIV += '</div>';

	DIV += '<div class="loader-part loader-part-2">';
	DIV += '<div class="loader-dot loader-dot-1"></div>';
	DIV += '<div class="loader-dot loader-dot-2"></div>';
	DIV += '</div>';
	DIV += '</div>';
	DIV += '</div>';

	return DIV;
}

function createAvatarField(user, type, more) {
	var level_class = ['tier-steel', 'tier-bronze', 'tier-silver', 'tier-gold', 'tier-diamond'][parseInt(user.level / 25)];

	var DIV = '<div class="avatar-field ' + level_class + ' relative">';
	DIV += '<img class="avatar icon-' + type + ' rounded-full" src="' + user.avatar + '">';
	DIV += '<div class="level sup-' + type + '-left flex justify-center items-center b-d2 bg-dark rounded-full">' + user.level + '</div>';
	DIV += more;
	DIV += '</div>';

	return DIV;
}

function roundedToFixed(number, decimals) {
	number = Number((parseFloat(number).toFixed(5)));

	var number_string = number.toString();
	var decimals_string = 0;

	if (number_string.split('.')[1] !== undefined) decimals_string = number_string.split('.')[1].length;

	while (decimals_string - decimals > 0) {
		number_string = number_string.slice(0, -1);

		decimals_string--;
	}

	return Number(number_string);
}

function getFormatAmount(amount) {
	return roundedToFixed(Number(amount), 2);
}

function getFormatAmountString(amount) {
	return getFormatAmount(amount).toFixed(2);
}

function getNumberFromString(amount) {
	if (amount.toString().trim().length <= 0) return 0;
	if (isNaN(Number(amount.toString().trim()))) return 0;

	return amount;
}

function generate_code(field, length) {
	var text = '';
	var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for (var i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));

	$(field).val(text);
	changeInputFieldLabel($(field).parent().parent().parent());
}

function getFormatSeconds(time) {
	var days = parseInt((time) / (24 * 60 * 60));
	var hours = parseInt((time - (days * 24 * 60 * 60)) / (60 * 60));
	var minutes = parseInt((time - (days * 24 * 60 * 60) - (hours * 60 * 60)) / (60));
	var seconds = parseInt((time - (days * 24 * 60 * 60) - (hours * 60 * 60) - (minutes * 60)));

	if (days < 10) days = '0'.concat(days);
	if (hours < 10) hours = '0'.concat(hours);
	if (minutes < 10) minutes = '0'.concat(minutes);
	if (seconds < 10) seconds = '0'.concat(seconds);

	return {
		days,
		hours,
		minutes,
		seconds
	};
}

function hexToRgb(hex) {
	var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
	hex = hex.replace(shorthandRegex, function (m, r, g, b) {
		return r + r + g + g + b + b;
	});

	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}

function capitalizeText(text) {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function time() {
	return parseInt(new Date().getTime() / 1000);
}