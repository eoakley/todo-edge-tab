document.addEventListener('DOMContentLoaded', function() {
    // Configurações padrão
    const defaultSettings = {
        newTaskPosition: 'top',
        newSubtaskPosition: 'bottom',
        theme: 'dark',
        confettiEnabled: true,
        timersEnabled: true,
        showHolidays: true,
        country: 'BR',
        language: 'pt-BR'
    };

    // Estado da sessão para preservar entre tabs
    let sessionState = {
        expandedTasks: [],
        focusedElementId: null,
        cursorPosition: 0,
        lastDescriptionTaskId: null,
        parentTaskId: null
    };

    // Carregar configurações
    let settings = { ...defaultSettings };
    chrome.storage.local.get(['settings'], function(result) {
        if (result.settings) {
            settings = { ...defaultSettings, ...result.settings };
            applySettings(settings);
        }
        // Inicializar traduções após carregar configurações
        updateTranslations();
        updateTooltips();
    });

    // Função para atualizar tooltips
    function updateTooltips() {
        $('[data-tooltip]').each(function() {
            const tooltipKey = $(this).attr('data-tooltip');
            const tooltipText = getTranslation(tooltipKey, settings.language);
            $(this).attr('title', tooltipText);
        });
    }

    // Variáveis para controle das frases
    let currentQuotes = [];
    let currentQuoteIndex = -1;

    // Função para carregar e exibir uma frase aleatória ou a próxima na sequência
    function loadAndDisplayQuote(cycleToNext = false) {
        fetch('frases.json')
            .then(response => response.json())
            .then(data => {
                if (currentQuotes.length === 0) {
                    currentQuotes = data.quotes;
                    // Embaralhar as frases
                    for (let i = currentQuotes.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [currentQuotes[i], currentQuotes[j]] = [currentQuotes[j], currentQuotes[i]];
                    }
                }

                if (cycleToNext) {
                    currentQuoteIndex = (currentQuoteIndex + 1) % currentQuotes.length;
                } else if (currentQuoteIndex === -1) {
                    currentQuoteIndex = 0;
                }

                const quote = currentQuotes[currentQuoteIndex];
                
                // Animar a transição
                const quoteElement = document.getElementById('quote');
                const authorElement = document.getElementById('author');
                
                quoteElement.style.opacity = '0';
                authorElement.style.opacity = '0';
                
                setTimeout(() => {
                    quoteElement.textContent = `"${quote.text}"`;
                    authorElement.textContent = `- ${quote.author}`;
                    
                    quoteElement.style.opacity = '1';
                    authorElement.style.opacity = '1';
                }, 300);
            })
            .catch(error => {
                console.error('Erro ao carregar as frases:', error);
                document.getElementById('quote').textContent = getTranslation('quotes.fallback_quote', settings.language);
                document.getElementById('author').textContent = `- ${getTranslation('quotes.fallback_author', settings.language)}`;
            });
    }

    // Adicionar click handler para a frase
    $('.quote-container').click(function() {
        loadAndDisplayQuote(true);
    });

    // Carregar frase inicial
    loadAndDisplayQuote();

    // Função para formatar tempo em HH:MM:SS
    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    // Função para formatar data
    function formatDate(date) {
        return new Intl.DateTimeFormat(settings.language, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    // Função para salvar tarefa no histórico
    function saveToHistory(taskData) {
        chrome.storage.local.get(['taskHistory'], function(result) {
            const history = result.taskHistory || [];
            const historyItem = {
                text: taskData.text,
                timeSpent: taskData.timeSpent || 0,
                completedAt: new Date().toISOString(),
                description: taskData.description || '',
                subtasks: taskData.subtasks || []
            };
            
            history.unshift(historyItem); // Adiciona no início do array
            
            // Limitar o histórico a 100 itens
            if (history.length > 100) {
                history.pop();
            }
            
            chrome.storage.local.set({ taskHistory: history });
        });
    }

    // Função para carregar e exibir o histórico
    function loadHistory() {
        chrome.storage.local.get(['taskHistory'], function(result) {
            const history = result.taskHistory || [];
            const historyList = $('.history-list');
            historyList.empty();
            
            if (history.length === 0) {
                historyList.append(`<div class="history-item">${getTranslation('history.empty', settings.language)}</div>`);
                return;
            }
            
            history.forEach(item => {
                const completedDate = new Date(item.completedAt);
                const historyItem = $('<div>').addClass('history-item');
                
                const header = $('<div>').addClass('history-item-header');
                header.append($('<span>').addClass('history-item-title').text(item.text));
                header.append($('<span>').addClass('history-item-date')
                    .text(`${getTranslation('history.completed_at', settings.language)} ${formatDate(completedDate)}`));
                
                const timeSpent = $('<div>').addClass('history-item-time')
                    .text(`${getTranslation('history.time_spent', settings.language)}: ${formatTime(item.timeSpent)}`);
                
                historyItem.append(header, timeSpent);
                
                // Adicionar descrição se existir
                if (item.description) {
                    const description = $('<div>').addClass('history-item-description')
                        .text(item.description);
                    historyItem.append(description);
                }
                
                // Adicionar subtarefas se existirem
                if (item.subtasks && item.subtasks.length > 0) {
                    const subtasksList = $('<ul>').addClass('history-item-subtasks');
                    item.subtasks.forEach(subtask => {
                        subtasksList.append($('<li>').text(subtask.text));
                    });
                    historyItem.append(subtasksList);
                }
                
                historyList.append(historyItem);
            });
        });
    }

    // Event listeners para o histórico
    $('#historyBtn').click(function() {
        loadHistory();
        $('.history-modal').addClass('active');
    });

    $('.history-close').click(function() {
        $('.history-modal').removeClass('active');
    });

    // Botão de limpar histórico
    $('.history-clear').click(function() {
        if (confirm(getTranslation('history.clear_confirm', settings.language))) {
            chrome.storage.local.set({ taskHistory: [] }, function() {
                if (chrome.runtime.lastError) {
                    console.error('Erro ao limpar histórico:', chrome.runtime.lastError);
                    return;
                }
                loadHistory(); // Recarrega o histórico vazio
            });
        }
    });

    // Fechar modal ao clicar fora
    $('.history-modal').click(function(e) {
        if ($(e.target).hasClass('history-modal')) {
            $(this).removeClass('active');
        }
    });

    // Modificar a função de checkbox para salvar no histórico quando completar
    function handleTaskCompletion(taskElement, isCompleted) {
        const textSpan = taskElement.find('> .task-text');
        textSpan.toggleClass('completed', isCompleted);

        // Se for uma tarefa principal e estiver sendo marcada como completa
        if (!taskElement.hasClass('subtask') && isCompleted) {
            const taskData = {
                text: textSpan.text(),
                timeSpent: parseInt(taskElement.data('timeSpent')) || 0,
                description: taskElement.data('description') || '',
                subtasks: []
            };

            // Coletar subtarefas
            taskElement.find('.subtask-list > .task-item').each(function() {
                const $subtask = $(this);
                taskData.subtasks.push({
                    text: $subtask.find('.task-text').text(),
                    completed: $subtask.find('.task-checkbox').prop('checked'),
                    description: $subtask.data('description') || ''
                });
            });

            // Salvar no histórico
            saveToHistory(taskData);

            // Pausar o timer se estiver ativo
            const timerBtn = taskElement.find('.timer-btn.toggle-timer');
            if (timerBtn.hasClass('active')) {
                timerBtn.removeClass('active')
                    .html('<i class="fas fa-play"></i>');
                pauseTimer(taskElement);
            }
            showCompletionAnimation(event, parseInt(taskElement.data('timeSpent') || 0));
        }

        // Se for uma tarefa principal, atualizar todas as subtarefas
        if (!taskElement.hasClass('subtask')) {
            const subtasks = taskElement.find('.subtask-list .task-checkbox');
            subtasks.prop('checked', isCompleted);
            subtasks.each(function() {
                $(this).closest('.task-item').find('.task-text').toggleClass('completed', isCompleted);
            });
        }

        saveTasks();
    }

    // Modificar a criação do checkbox no createTaskElement
    const checkbox = $('<input>')
        .attr('type', 'checkbox')
        .addClass('task-checkbox')
        .click(function(e) {
            const isCompleted = $(this).prop('checked');
            handleTaskCompletion($(this).closest('.task-item'), isCompleted);
        });

    // Função para atualizar traduções
    function updateTranslations() {
        const lang = settings.language;
        
        // Atualizar textos
        $('[data-i18n]').each(function() {
            const key = $(this).attr('data-i18n');
            const translation = getTranslation(key, lang);
            $(this).text(translation);
        });

        // Atualizar placeholders
        $('[data-i18n-placeholder]').each(function() {
            const key = $(this).attr('data-i18n-placeholder');
            const translation = getTranslation(key, lang);
            $(this).attr('placeholder', translation);
        });

        // Atualizar opções de select mantendo os valores selecionados
        $('select').each(function() {
            const currentValue = $(this).val();
            $(this).find('option[data-i18n]').each(function() {
                const key = $(this).attr('data-i18n');
                const translation = getTranslation(key, lang);
                $(this).text(translation);
            });
            $(this).val(currentValue);
        });
    }

    // Função auxiliar para obter tradução
    function getTranslation(key, lang) {
        const keys = key.split('.');
        let value = translations[lang];
        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                console.warn(`Translation missing for key: ${key} in language: ${lang}`);
                return key;
            }
        }
        return value;
    }

    // Aplicar configurações
    function applySettings(settings) {
        // Aplicar tema
        $('html').attr('data-theme', settings.theme);
        
        // Aplicar visibilidade dos timers
        $('.timer-container').toggle(settings.timersEnabled);
        
        // Atualizar valores no modal de configurações
        $('#newTaskPosition').val(settings.newTaskPosition);
        $('#newSubtaskPosition').val(settings.newSubtaskPosition);
        $('#themeSelect').val(settings.theme);
        $('#confettiEnabled').val(settings.confettiEnabled.toString());
        $('#timersEnabled').val(settings.timersEnabled.toString());
        $('#showHolidays').val(settings.showHolidays.toString());
        $('#country').val(settings.country);
        $('#language').val(settings.language);

        // Atualizar traduções e tooltips
        updateTranslations();
        updateTooltips();
    }

    // Salvar configurações
    function saveSettings(newSettings) {
        const oldLang = settings.language;
        settings = { ...settings, ...newSettings };
        chrome.storage.local.set({ settings }, function() {
            if (chrome.runtime.lastError) {
                console.error('Erro ao salvar configurações:', chrome.runtime.lastError);
                return;
            }
            applySettings(settings);
        });
    }

    // Event listeners para o modal de configurações
    $('#settingsBtn').click(function() {
        $('.settings-modal').addClass('active');
    });

    // Fechar modal ao clicar no botão fechar
    $('.settings-close').click(function() {
        $('.settings-modal').removeClass('active');
    });

    // Fechar modal ao clicar fora
    $('.settings-modal').click(function(e) {
        if ($(e.target).hasClass('settings-modal')) {
            $(this).removeClass('active');
        }
    });

    // Event listeners para o modal de ajuda
    $('#helpBtn').click(function() {
        $('.help-modal').addClass('active');
    });

    // Fechar modal de ajuda ao clicar no botão fechar
    $('.help-close').click(function() {
        $('.help-modal').removeClass('active');
    });

    // Fechar modal de ajuda ao clicar fora
    $('.help-modal').click(function(e) {
        if ($(e.target).hasClass('help-modal')) {
            $(this).removeClass('active');
        }
    });

    // Aplicar configurações instantaneamente quando mudarem
    $('#newTaskPosition, #newSubtaskPosition, #themeSelect, #confettiEnabled, #timersEnabled, #showHolidays, #country, #language').change(function() {
        const newSettings = {
            newTaskPosition: $('#newTaskPosition').val(),
            newSubtaskPosition: $('#newSubtaskPosition').val(),
            theme: $('#themeSelect').val(),
            confettiEnabled: $('#confettiEnabled').val() === 'true',
            timersEnabled: $('#timersEnabled').val() === 'true',
            showHolidays: $('#showHolidays').val() === 'true',
            country: $('#country').val(),
            language: $('#language').val()
        };
        saveSettings(newSettings);
    });

    // Botão para restaurar configurações padrão
    $('.settings-default').click(function() {
        if (confirm(getTranslation('settings.default_confirm', settings.language))) {
            saveSettings(defaultSettings);
        }
    });

    // Adicionar event listener para atualizar tarefas quando a janela ganhar foco
    window.addEventListener('focus', function() {
        console.log('Popup ganhou foco - atualizando tarefas...');
        loadTasks();
    });

    // Inicializar relógio e data
    function updateDateTime() {
        const now = new Date();
        
        // Atualizar relógio (formato 24h para ambos os idiomas)
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
        
        // Atualizar data com o idioma correto
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const dateStr = now.toLocaleDateString(settings.language, options);
        document.getElementById('date').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    }
    
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Inicializar calendário
    let currentDate = new Date();
    let holidays = [];

    // Toggle do calendário ao clicar no display de data/hora
    $('#datetime-display').click(function() {
        $('.calendar-widget').toggleClass('active');
        if ($('.calendar-widget').hasClass('active')) {
            updateCalendar();
            fetchHolidays();
        }
    });

    // Fechar calendário ao clicar fora
    $(document).click(function(e) {
        if (!$(e.target).closest('.calendar-widget').length && 
            !$(e.target).closest('#datetime-display').length) {
            $('.calendar-widget').removeClass('active');
        }
    });

    // Navegação do calendário
    $('.prev-month').click(function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        updateCalendar();
        fetchHolidays();
    });

    $('.next-month').click(function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        updateCalendar();
        fetchHolidays();
    });

    function updateCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // Atualizar cabeçalho do mês
        const monthName = new Intl.DateTimeFormat(settings.language, { month: 'long', year: 'numeric' }).format(currentDate);
        $('.current-month').text(monthName);
        
        // Atualizar dias da semana
        const weekdays = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(2024, 0, i + 1); // Usar uma data fixa para pegar os nomes dos dias
            weekdays.push(new Intl.DateTimeFormat(settings.language, { weekday: 'short' }).format(date));
        }
        
        const weekdaysContainer = $('.calendar-weekdays').empty();
        weekdays.forEach(day => {
            weekdaysContainer.append($('<span>').text(day));
        });
        
        // Calcular dias do mês
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();
        
        // Limpar e preencher grade de dias
        const daysContainer = $('.calendar-days').empty();
        
        // Dias do mês anterior
        const prevMonth = new Date(year, month, 0);
        const daysInPrevMonth = prevMonth.getDate();
        for (let i = startingDay - 1; i >= 0; i--) {
            const dayDiv = $('<div>')
                .addClass('calendar-day other-month')
                .text(daysInPrevMonth - i);
            daysContainer.append(dayDiv);
        }
        
        // Dias do mês atual
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const dayDiv = $('<div>').addClass('calendar-day').text(i);
            
            // Marcar dia atual
            if (year === today.getFullYear() && 
                month === today.getMonth() && 
                i === today.getDate()) {
                dayDiv.addClass('today');
            }
            
            // Marcar feriados
            const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            if (holidays.some(h => h.date === currentDateStr)) {
                dayDiv.addClass('has-holiday');
            }
            
            daysContainer.append(dayDiv);
        }
        
        // Dias do próximo mês
        const totalCells = 42; // 6 linhas x 7 dias
        const remainingCells = totalCells - (startingDay + daysInMonth);
        for (let i = 1; i <= remainingCells; i++) {
            const dayDiv = $('<div>')
                .addClass('calendar-day other-month')
                .text(i);
            daysContainer.append(dayDiv);
        }
    }

    async function fetchHolidays() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        try {
            // Usar o país das configurações
            const countryCode = settings.country;
            
            // Só buscar feriados se estiverem habilitados
            if (!settings.showHolidays) {
                $('.calendar-holidays').empty();
                return;
            }
            
            // Usando a API Nager.Date para feriados
            const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
            if (!response.ok) throw new Error(`Erro ao buscar feriados para ${countryCode}`);
            
            const allHolidays = await response.json();
            
            // Filtrar feriados do mês atual
            holidays = allHolidays.filter(h => {
                const holidayDate = new Date(h.date);
                return holidayDate.getMonth() + 1 === month;
            });
            
            // Atualizar lista de feriados
            const holidaysContainer = $('.calendar-holidays').empty();
            
            if (holidays.length === 0) {
                holidaysContainer.append($('<div>')
                    .addClass('holiday-item')
                    .text(settings.language === 'pt-BR' ? 'Nenhum feriado este mês' : 'No holidays this month'));
            } else {
                holidays.forEach(holiday => {
                    const date = new Date(holiday.date);
                    const formattedDate = new Intl.DateTimeFormat(settings.language, {
                        day: 'numeric',
                        month: 'short'
                    }).format(date);
                    
                    const holidayItem = $('<div>').addClass('holiday-item');
                    holidayItem.append(
                        $('<span>').text(settings.language === 'pt-BR' ? holiday.localName : holiday.name),
                        $('<span>').addClass('holiday-date').text(formattedDate)
                    );
                    holidaysContainer.append(holidayItem);
                });
            }
            
            // Atualizar marcadores de feriado no calendário
            updateCalendar();
            
        } catch (error) {
            console.error('Erro ao buscar feriados:', error);
            $('.calendar-holidays').html(
                `<div class="holiday-item">${settings.language === 'pt-BR' ? 'Erro ao carregar feriados' : 'Error loading holidays'}</div>`
            );
        }
    }

    // Inicializar tema
    initializeTheme();
    
    // Carregar tarefas salvas quando o popup abrir
    loadTasks();

    // Auto-focus no input
    $('#taskInput').focus();

    // Adicionar focus handler para o input principal
    $('#taskInput').on('focus', function() {
        // Salvar o estado do foco quando o input principal recebe foco
        setTimeout(saveSessionState, 50);
    });

    // Adicionar tarefa quando o botão for clicado
    $('#addTask').click(addTask);

    // Adicionar tarefa quando Enter for pressionado
    $('#taskInput').keypress(function(e) {
        if (e.which == 13) {
            addTask();
        }
    });

    // Suporte para colar múltiplas tarefas
    $('#taskInput').on('paste', function(e) {
        const pastedText = (e.originalEvent.clipboardData || window.clipboardData).getData('text');
        
        // Se não houver quebras de linha no meio do texto, deixa o comportamento padrão
        if (!pastedText.includes('\n')) {
            return;
        }
        
        // Se houver quebras de linha, previne o comportamento padrão
        e.preventDefault();
        
        const tasks = pastedText.split('\n').filter(task => task.trim() !== '');
        
        // Cria tarefas para cada linha
        tasks.forEach(task => {
            if (task.trim()) {
                const taskItem = createTaskElement(task.trim());
                $('#taskList').prepend(taskItem);
            }
        });
        
        if (tasks.length > 0) {
            saveTasks();
            $(this).val('');
        }
    });

    // Toggle do tema
    $('#themeToggle').click(function() {
        const isDark = $('html').attr('data-theme') === 'dark';
        $('html').attr('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        $(this).find('i').toggleClass('fa-sun fa-moon');
    });

    function addTask() {
        const taskInput = $('#taskInput');
        const taskText = taskInput.val().trim();
        
        if (taskText) {
            const taskItem = createTaskElement(taskText);
            
            // Adicionar tarefa baseado na configuração
            if (settings.newTaskPosition === 'top') {
                $('#taskList').prepend(taskItem);
            } else {
                $('#taskList').append(taskItem);
            }
            
            taskInput.val('').focus();
            saveTasks();
            
            // Salvar o estado da sessão após adicionar uma tarefa
            setTimeout(saveSessionState, 100);
        }
    }

    function createTaskElement(taskText, isSubtask = false) {
        const li = $('<li>')
            .addClass('task-item')
            .attr('draggable', true)
            .attr('id', generateTaskId())
            .on('dragstart', handleDragStart)
            .on('dragend', handleDragEnd)
            .on('dragover', handleDragOver)
            .on('dragenter', handleDragEnter)
            .on('dragleave', handleDragLeave)
            .on('drop', handleDrop);
            
        if (isSubtask) {
            li.addClass('subtask');
        }

        const checkbox = $('<input>')
            .attr('type', 'checkbox')
            .addClass('task-checkbox')
            .click(function(e) {
                const isCompleted = $(this).prop('checked');
                handleTaskCompletion($(this).closest('.task-item'), isCompleted);
            });

        const textSpan = $('<span>')
            .addClass('task-text')
            .text(taskText)
            .click(function(e) {
                // Não permitir edição se a tarefa estiver completa
                if ($(this).hasClass('completed')) return;
                
                const currentText = $(this).text();
                const input = $('<input>')
                    .attr('type', 'text')
                    .addClass('task-input')
                    .attr('id', 'edit-' + $(this).closest('.task-item').attr('id'))
                    .val(currentText)
                    .blur(function() {
                        const newText = $(this).val().trim();
                        if (newText && newText !== currentText) {
                            $(this).parent().text(newText);
                            saveTasks();
                        } else {
                            $(this).parent().text(currentText);
                        }
                    })
                    .keypress(function(e) {
                        if (e.which === 13) {
                            $(this).blur();
                        }
                    })
                    .on('focus', function() {
                        // Salvar o estado do foco quando o input de edição recebe foco
                        setTimeout(saveSessionState, 50);
                    });
                $(this).html(input);
                input.focus();
                
                // Salvar o estado do foco após aplicar o foco
                setTimeout(saveSessionState, 100);
            });

        const timerContainer = $('<div>')
            .addClass('timer-container')
            .css('display', settings.timersEnabled ? '' : 'none')
            .append(
                $('<button>')
                    .addClass('timer-btn toggle-timer')
                    .html('<i class="fas fa-play"></i>')
                    .click(function() {
                        const btn = $(this);
                        const isPlaying = btn.hasClass('active');
                        const taskItem = btn.closest('.task-item');
                        
                        // Se não estiver tocando e a tarefa não estiver expandida, expande
                        if (!isPlaying && !isSubtask) {
                            const expandBtn = taskItem.find('> .expand-btn');
                            const subtasksContainer = taskItem.find('> .subtasks-container');
                            if (!expandBtn.hasClass('expanded')) {
                                expandBtn.addClass('expanded');
                                subtasksContainer.addClass('expanded');
                            }
                        }
                        
                        // Pausar qualquer outro timer ativo
                        if (!isPlaying) {
                            $('.timer-btn.toggle-timer.active').each(function() {
                                $(this).removeClass('active')
                                    .html('<i class="fas fa-play"></i>');
                                pauseTimer($(this).closest('.task-item'));
                            });
                        }
                        
                        btn.toggleClass('active');
                        btn.html(isPlaying ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>');
                        
                        if (!isPlaying) {
                            startTimer(li);
                        } else {
                            pauseTimer(li);
                        }
                    }),
                $('<span>')
                    .addClass('timer-display')
                    .text('00:00:00')
                    .click(function() {
                        // Pausar o timer se estiver rodando
                        const timerBtn = $(this).closest('.timer-container').find('.timer-btn');
                        if (timerBtn.hasClass('active')) {
                            timerBtn.removeClass('active')
                                .html('<i class="fas fa-play"></i>');
                            pauseTimer($(this).closest('.task-item'));
                        }

                        const currentDisplay = $(this).text();
                        const input = $('<input>')
                            .attr('type', 'text')
                            .addClass('timer-input')
                            .attr('id', 'timer-input-' + $(this).closest('.task-item').attr('id'))
                            .val(currentDisplay)
                            .on('input', function(e) {
                                let value = e.target.value.replace(/[^\d:]/g, '');
                                const parts = value.split(':');
                                
                                // Adicionar : automaticamente
                                if (value.length === 2 && !value.includes(':')) {
                                    value += ':';
                                } else if (value.length === 5 && value.split(':').length === 2) {
                                    value += ':';
                                }
                                
                                // Limitar a 8 caracteres (HH:MM:SS)
                                if (value.length > 8) {
                                    value = value.slice(0, 8);
                                }
                                
                                e.target.value = value;
                            })
                            .blur(function() {
                                let newTime = $(this).val();
                                const parts = newTime.split(':').map(part => part.padStart(2, '0'));
                                
                                // Validar e formatar o tempo
                                if (parts.length === 3) {
                                    const [hours, minutes, seconds] = parts.map(Number);
                                    if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds) &&
                                        minutes < 60 && seconds < 60) {
                                        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                                        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                                        li.data('timeSpent', totalSeconds);
                                        $(this).parent().html(formattedTime);
                                        saveTasks();
                                        return;
                                    }
                                }
                                $(this).parent().html(currentDisplay);
                            })
                            .keypress(function(e) {
                                if (e.which === 13) {
                                    $(this).blur();
                                }
                            })
                            .on('focus', function() {
                                // Salvar o estado do foco quando o input do timer recebe foco
                                setTimeout(saveSessionState, 50);
                            });
                        $(this).html(input);
                        input.focus();
                    })
            );

        const descriptionBtn = $('<button>')
            .addClass('description-btn')
            .html('<i class="fas fa-sticky-note"></i>')
            .click(function() {
                const modal = $('.description-modal');
                const textarea = modal.find('.description-textarea');
                const currentDescription = li.data('description') || '';
                
                textarea.val(currentDescription);
                modal.addClass('active');
                textarea.focus();

                // Salvar referência ao item atual
                modal.data('currentTask', li);
            });

        // Se já houver uma descrição, adicionar a classe has-description
        if (li.data('description')) {
            descriptionBtn.addClass('has-description');
        }

        const deleteBtn = $('<button>')
            .addClass('delete-btn')
            .html('<i class="fas fa-trash"></i>')
            .click(function(e) {
                // Só mostra animação se não for subtarefa
                if (!$(this).closest('.task-item').hasClass('subtask')) {
                    showDeletionAnimation(e);
                }
                li.fadeOut(300, function() {
                    li.remove();
                    saveTasks();
                });
            });

        // Adicionar botão de expandir apenas para tarefas principais
        if (!isSubtask) {
            const expandBtn = $('<button>')
                .addClass('expand-btn')
                .html('<i class="fas fa-chevron-right"></i>')
                .click(function() {
                    // Verifica o estado atual antes de alterá-lo
                    const isCurrentlyExpanded = $(this).hasClass('expanded');
                    
                    // Alterna a classe com base no estado atual
                    $(this).toggleClass('expanded', !isCurrentlyExpanded);
                    subtasksContainer.toggleClass('expanded', !isCurrentlyExpanded);
                    
                    // Salvar o estado da sessão quando uma tarefa é expandida/recolhida
                    saveSessionState();
                });

            // Criar container de subtarefas
            const subtasksContainer = $('<div>').addClass('subtasks-container');
            
            // Criar lista de subtarefas
            const subtaskList = $('<ul>')
                .addClass('subtask-list')
                .on('dragover', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if ($(draggedItem).hasClass('subtask')) {
                        e.dataTransfer.dropEffect = 'move';
                        
                        // Se não houver subtarefas, mostrar indicador no container
                        if ($(this).children('.subtask').length === 0) {
                            $('.drop-indicator').remove();
                            const newIndicator = dropIndicator.clone();
                            $(this).append(newIndicator);
                            newIndicator.addClass('active');
                        }
                    }
                })
                .on('drop', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if ($(draggedItem).hasClass('subtask') && 
                        $(this).closest('.subtasks-container').is($(draggedItem).closest('.subtasks-container'))) {
                        // Se não houver subtarefas, adicionar ao final da lista
                        if ($(this).children('.subtask').length === 0) {
                            $(this).append(draggedItem);
                            saveTasks();
                        }
                    }
                    
                    $('.drop-indicator').remove();
                });
            
            // Criar placeholder para adicionar nova subtarefa
            const addSubtaskPlaceholder = $('<div>')
                .addClass('add-subtask-placeholder')
                .html(`<i class="fas fa-plus"></i> <span data-i18n="task.add_subtask">${getTranslation('task.add_subtask', settings.language)}</span>`)
                .click(function() {
                    // Remover placeholder
                    $(this).hide();
                    
                    // Mostrar input container
                    const inputContainer = $('<div>').addClass('input-container');
                    const subtaskInput = $('<input>')
                        .attr('type', 'text')
                        .attr('placeholder', getTranslation('task.new_subtask', settings.language))
                        .attr('id', 'subtask-input-' + $(this).closest('.task-item').attr('id'))
                        .addClass('subtask-input')
                        .keypress(function(e) {
                            if (e.which == 13) {
                                addSubtask(subtaskInput);
                                // Manter o input e focar nele
                                $(this).val('').focus();
                                // Salvar o estado do foco após aplicar o foco
                                setTimeout(saveSessionState, 100);
                            }
                        })
                        .on('focus', function() {
                            // Salvar o estado do foco quando o input recebe foco
                            setTimeout(saveSessionState, 50);
                        });
                    const addButton = $('<button>')
                        .text('Adicionar')
                        .click(function() {
                            addSubtask(subtaskInput);
                            // Manter o input e focar nele
                            subtaskInput.val('').focus();
                            // Salvar o estado do foco após aplicar o foco
                            setTimeout(saveSessionState, 100);
                        });
                    
                    inputContainer.append(subtaskInput, addButton);
                    subtasksContainer.append(inputContainer);
                    subtaskInput.focus();

                    // Adicionar handler para clicar fora
                    $(document).on('mousedown', function handleClickOutside(e) {
                        if (!inputContainer.is(e.target) && inputContainer.has(e.target).length === 0) {
                            $(document).off('mousedown', handleClickOutside);
                            addSubtaskPlaceholder.show();
                            inputContainer.remove();
                        }
                    });
                });
            
            // Montar a estrutura completa
            subtasksContainer.append(subtaskList, addSubtaskPlaceholder);

            li.append(checkbox, expandBtn, textSpan, timerContainer, descriptionBtn, deleteBtn, subtasksContainer);
        } else {
            li.append(checkbox, textSpan, descriptionBtn, deleteBtn);
        }

        return li;
    }

    function addSubtask(input) {
        const subtaskText = input.val().trim();
        if (subtaskText) {
            const subtaskItem = createTaskElement(subtaskText, true);
            const subtaskList = input.closest('.subtasks-container').find('.subtask-list');
            
            // Adicionar subtarefa baseado na configuração
            if (settings.newSubtaskPosition === 'top') {
                subtaskList.prepend(subtaskItem);
            } else {
                subtaskList.append(subtaskItem);
            }
            
            input.val('').focus();
            saveTasks();
        }
    }

    // Funções de Drag and Drop
    let draggedItem = null;
    let dropIndicator = $('<div>').addClass('drop-indicator');

    function handleDragStart(e) {
        e.stopPropagation(); // Prevent event from bubbling up
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        
        // Armazenar informação se é uma subtarefa
        draggedItem.isSubtask = $(this).hasClass('subtask');
        
        $('.drop-indicator').remove();
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        // Remover o indicador
        $('.drop-indicator').remove();
        draggedItem = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent event from bubbling up
        
        const isSubtask = $(this).hasClass('subtask');
        const draggedIsSubtask = $(draggedItem).hasClass('subtask');
        
        // Permitir drop apenas se:
        // 1. Ambos são tarefas principais, ou
        // 2. Ambos são subtarefas do mesmo pai
        if (!isSubtask && !draggedIsSubtask) {
            e.dataTransfer.dropEffect = 'move';
        } else if (isSubtask && draggedIsSubtask) {
            const currentParent = $(this).closest('.subtasks-container');
            const draggedParent = $(draggedItem).closest('.subtasks-container');
            if (currentParent.is(draggedParent)) {
                e.dataTransfer.dropEffect = 'move';
            }
        }
    }

    function handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent event from bubbling up
        
        if (this === draggedItem) return;
        
        const isSubtask = $(this).hasClass('subtask');
        const draggedIsSubtask = $(draggedItem).hasClass('subtask');
        
        // Verificar se o drop é permitido
        if ((!isSubtask && !draggedIsSubtask) || 
            (isSubtask && draggedIsSubtask && 
             $(this).closest('.subtasks-container').is($(draggedItem).closest('.subtasks-container')))) {
            
            // Remover qualquer indicador existente
            $('.drop-indicator').remove();
            
            // Criar e inserir novo indicador
            const newIndicator = dropIndicator.clone();
            $(this).before(newIndicator);
            newIndicator.addClass('active');
        }
    }

    function handleDragLeave(e) {
        e.stopPropagation(); // Prevent event from bubbling up
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget || !this.contains(relatedTarget)) {
            // Remover o indicador apenas se o mouse sair completamente do item
            $('.drop-indicator').remove();
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent event from bubbling up

        const isSubtask = $(this).hasClass('subtask');
        const draggedIsSubtask = $(draggedItem).hasClass('subtask');

        // Verificar se o drop é permitido
        if ((!isSubtask && !draggedIsSubtask) || 
            (isSubtask && draggedIsSubtask && 
             $(this).closest('.subtasks-container').is($(draggedItem).closest('.subtasks-container')))) {
            
            if (draggedItem !== this) {
                this.parentNode.insertBefore(draggedItem, this);
                saveTasks();
            }
        }

        $('.drop-indicator').remove();
        return false;
    }

    function saveTasks() {
        const tasks = [];
        $('#taskList > .task-item').each(function() {
            const $task = $(this);
            const taskData = {
                text: $task.find('> .task-text').text(),
                completed: $task.find('> .task-checkbox').prop('checked'),
                timeSpent: parseInt($task.data('timeSpent')) || 0,
                timerStartTime: $task.find('.timer-btn').hasClass('active') ? $task.data('timerStartTime') : null,
                description: $task.data('description') || '',
                subtasks: [],
                id: $task.attr('id') || generateTaskId(),
                expanded: $task.find('> .subtasks-container').hasClass('expanded')
            };

            // Garante que cada tarefa tenha um ID
            if (!$task.attr('id')) {
                $task.attr('id', taskData.id);
            }

            // Save subtasks
            $task.find('.subtask-list > .task-item').each(function() {
                const $subtask = $(this);
                const subtaskId = $subtask.attr('id') || generateTaskId();
                
                // Garante que cada subtarefa tenha um ID
                if (!$subtask.attr('id')) {
                    $subtask.attr('id', subtaskId);
                }
                
                taskData.subtasks.push({
                    text: $subtask.find('.task-text').text(),
                    completed: $subtask.find('.task-checkbox').prop('checked'),
                    description: $subtask.data('description') || '',
                    id: subtaskId
                });
            });

            tasks.push(taskData);
        });

        // Salvar o estado da sessão atual
        saveSessionState();

        // Save to Chrome storage
        chrome.storage.local.set({ tasks: tasks }, function() {
            if (chrome.runtime.lastError) {
                console.error('Erro ao salvar tarefas:', chrome.runtime.lastError);
                return;
            }
            // Broadcast update to other tabs
            chrome.runtime.sendMessage({ 
                action: 'tasksUpdated', 
                tasks: tasks,
                source: 'popup'
            });
        });
    }

    // Gera um ID único para uma tarefa
    function generateTaskId() {
        return 'task-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    }

    // Salva o estado atual da sessão (tarefas expandidas e cursor)
    function saveSessionState() {
        // Captura todas as tarefas expandidas
        sessionState.expandedTasks = [];
        $('.task-item > .subtasks-container.expanded').each(function() {
            const taskId = $(this).closest('.task-item').attr('id');
            if (taskId) {
                sessionState.expandedTasks.push(taskId);
            }
        });

        // Captura o elemento atualmente em foco e a posição do cursor
        const activeElement = document.activeElement;
        if (activeElement) {
            sessionState.focusedElementId = activeElement.id || null;
            
            // Se for um input de texto, salva a posição do cursor
            if (activeElement.tagName === 'INPUT' && activeElement.type === 'text') {
                sessionState.cursorPosition = activeElement.selectionStart || 0;
            }
            
            // Se for um input de subtarefa, também salva o ID da tarefa pai
            if (activeElement.id && activeElement.id.startsWith('subtask-input-')) {
                sessionState.parentTaskId = activeElement.id.replace('subtask-input-', '');
            } else {
                sessionState.parentTaskId = null;
            }
        }

        // Salva na storage local
        chrome.storage.local.set({ sessionState: sessionState });
    }

    // Restaura o estado da sessão (tarefas expandidas e cursor)
    function restoreSessionState() {
        chrome.storage.local.get(['sessionState'], function(result) {
            if (result.sessionState) {
                sessionState = result.sessionState;
                
                // Restaura tarefas expandidas
                if (sessionState.expandedTasks && sessionState.expandedTasks.length > 0) {
                    sessionState.expandedTasks.forEach(taskId => {
                        const taskItem = $(`#${taskId}`);
                        if (taskItem.length) {
                            const expandBtn = taskItem.find('> .expand-btn');
                            const subtasksContainer = taskItem.find('> .subtasks-container');
                            expandBtn.addClass('expanded');
                            subtasksContainer.addClass('expanded');
                        }
                    });
                }
                
                // Restaura o foco e a posição do cursor
                if (sessionState.focusedElementId) {
                    const element = document.getElementById(sessionState.focusedElementId);
                    if (element) {
                        setTimeout(() => {
                            element.focus();
                            
                            // Se for um input de texto, restaura a posição do cursor
                            if (element.tagName === 'INPUT' && element.type === 'text' && sessionState.cursorPosition !== undefined) {
                                element.setSelectionRange(sessionState.cursorPosition, sessionState.cursorPosition);
                            }
                        }, 100);
                    }
                }
                // Verifica se havia uma descrição sendo editada
                else if (sessionState.lastDescriptionTaskId) {
                    const taskItem = $(`#${sessionState.lastDescriptionTaskId}`);
                    if (taskItem.length) {
                        // Simula o clique no botão de descrição para abrir o modal
                        setTimeout(() => {
                            taskItem.find('.description-btn').click();
                        }, 100);
                    }
                }
            }
        });
    }

    function loadTasks() {
        chrome.storage.local.get(['tasks'], function(result) {
            if (chrome.runtime.lastError) {
                console.error('Erro ao carregar tarefas:', chrome.runtime.lastError);
                return;
            }

            if (result.tasks && Array.isArray(result.tasks)) {
                $('#taskList').empty();
                result.tasks.forEach(taskData => {
                    const taskItem = createTaskElement(taskData.text);
                    
                    // Atribui o ID salvo da tarefa
                    if (taskData.id) {
                        taskItem.attr('id', taskData.id);
                    }
                    
                    // Restore task state
                    if (taskData.completed) {
                        taskItem.find('> .task-checkbox').prop('checked', true);
                        taskItem.find('> .task-text').addClass('completed');
                    }
                    
                    // Restore description
                    if (taskData.description) {
                        taskItem.data('description', taskData.description);
                        taskItem.find('.description-btn').addClass('has-description');
                    }
                    
                    // Restore timer state
                    const timeSpent = taskData.timeSpent || 0;
                    taskItem.data('timeSpent', timeSpent);
                    updateTimerDisplay(taskItem, timeSpent);
                    
                    if (taskData.timerStartTime) {
                        const timerBtn = taskItem.find('.timer-btn');
                        timerBtn.addClass('active').html('<i class="fas fa-pause"></i>');
                        
                        // Calculate elapsed time while popup was closed
                        const elapsedWhileClosed = Math.floor((Date.now() - taskData.timerStartTime) / 1000);
                        const totalTime = timeSpent + elapsedWhileClosed;
                        
                        // Update the time and start the timer
                        taskItem.data('timeSpent', totalTime);
                        taskItem.data('lastSavedTime', totalTime);
                        updateTimerDisplay(taskItem, totalTime);
                        startTimer(taskItem, true);
                    }
                    
                    // Restore subtasks
                    if (taskData.subtasks && taskData.subtasks.length > 0) {
                        const subtaskList = taskItem.find('.subtask-list');
                        taskData.subtasks.forEach(subtaskData => {
                            const subtask = createTaskElement(subtaskData.text, true);
                            
                            // Atribui o ID salvo da subtarefa
                            if (subtaskData.id) {
                                subtask.attr('id', subtaskData.id);
                            }
                            
                            if (subtaskData.completed) {
                                subtask.find('.task-checkbox').prop('checked', true);
                                subtask.find('.task-text').addClass('completed');
                            }
                            if (subtaskData.description) {
                                subtask.data('description', subtaskData.description);
                                subtask.find('.description-btn').addClass('has-description');
                            }
                            subtaskList.append(subtask);
                        });
                    }
                    
                    $('#taskList').append(taskItem);
                });
                
                // Depois de carregar as tarefas, restaura o estado da sessão
                restoreSessionState();
            }
        });
    }

    // Listen for updates from other tabs
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'tasksUpdated' && request.source !== 'popup') {
            loadTasks();
        }
    });

    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        $('html').attr('data-theme', savedTheme);
        if (savedTheme === 'dark') {
            $('#themeToggle i').removeClass('fa-moon').addClass('fa-sun');
        }
    }

    // Função para mostrar a animação de confete (atualizada)
    function showCompletionAnimation(e, timeSpent = 0) {
        // Se as animações estiverem desativadas, não fazer nada
        if (!settings.confettiEnabled) return;

        const colors = ["#4CAF50", "#45a049", "#66bb6a", "#81c784"];
        
        const bounds = e.target.getBoundingClientRect();
        const x = (bounds.right) / window.innerWidth;
        const y = bounds.top / window.innerHeight;

        // Base confetti amount for tasks under 2 minutes
        let particleCount = 75;
        let spread = 80;
        
        // Scale confetti based on time spent
        if (timeSpent > 0) {
            const minutes = timeSpent / 60;
            if (minutes > 300) { // 5 hours+
                particleCount = 750; // 10x
                spread = 160;
            } else if (minutes > 180) { // 3 hours+
                particleCount = 600; // 8x
                spread = 140;
            } else if (minutes > 60) { // 1 hour+
                particleCount = 450; // 6x
                spread = 120;
            } else if (minutes > 30) { // 30 minutes+
                particleCount = 300; // 4x
                spread = 100;
            } else if (minutes > 10) { // 10 minutes+
                particleCount = 150; // 2x
                spread = 90;
            }
        }

        confetti({
            particleCount: particleCount,
            spread: spread,
            origin: { x, y },
            colors: colors,
            ticks: 400,
            gravity: 0.8,
            scalar: 1.5,
            shapes: ["circle", "square"],
            zIndex: 9999
        });
    }

    // Função para mostrar a animação de partículas na deleção
    function showDeletionAnimation(e) {
        // Se as animações estiverem desativadas, não fazer nada
        if (!settings.confettiEnabled) return;

        // Desabilita confetes no delete.
        return;

        const colors = ["#ff4444", "#cc0000", "#d32f2f", "#b71c1c"];
        
        const bounds = e.target.closest('.task-item').getBoundingClientRect();
        const x = (bounds.right) / window.innerWidth;
        const y = bounds.top / window.innerHeight;

        confetti({
            particleCount: 100,
            spread: 90,
            origin: { x, y },
            colors: colors,
            ticks: 300,
            gravity: 1,
            scalar: 1.4,
            shapes: ["circle"],
            zIndex: 9999
        });
    }

    function startTimer(taskElement, isRestore = false) {
        // Clear any existing interval
        if (taskElement.data('timerInterval')) {
            clearInterval(taskElement.data('timerInterval'));
        }
        
        const now = Date.now();
        if (!isRestore) {
            taskElement.data('timerStartTime', now);
            // Store the initial timeSpent as lastSavedTime
            taskElement.data('lastSavedTime', parseInt(taskElement.data('timeSpent')) || 0);
        }
        taskElement.addClass('timer-active');
        
        let lastTick = Date.now();
        const timerInterval = setInterval(() => {
            if (!taskElement.find('.timer-btn').hasClass('active')) {
                clearInterval(timerInterval);
                return;
            }
            
            const currentTime = Date.now();
            const tickDiff = Math.floor((currentTime - lastTick) / 1000);
            
            if (tickDiff >= 1) {
                const currentTotal = parseInt(taskElement.data('timeSpent')) || 0;
                updateTimerDisplay(taskElement, currentTotal + 1);
                lastTick = currentTime;
            }
        }, 100); // Check more frequently for smoother updates
        
        taskElement.data('timerInterval', timerInterval);
        
        // Only save if it's not a restore operation
        if (!isRestore) {
            saveTasks();
        }
    }

    function pauseTimer(taskElement) {
        clearInterval(taskElement.data('timerInterval'));
        taskElement.removeData('timerInterval');
        taskElement.removeData('timerStartTime');
        taskElement.removeClass('timer-active');
        saveTasks();
    }

    function updateTimerDisplay(taskElement, seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
        taskElement.find('.timer-display').text(display);
        taskElement.data('timeSpent', seconds);
    }

    // Add event listener for when the popup is about to close
    window.addEventListener('unload', function() {
        // Save the current state of all timers
        $('.task-item').each(function() {
            const $task = $(this);
            if ($task.find('.timer-btn').hasClass('active')) {
                const timeSpent = parseInt($task.data('timeSpent')) || 0;
                $task.data('timeSpent', timeSpent);
            }
        });
        saveTasks();
    });

    // Adicionar handlers para o modal de descrição
    $('.description-cancel').click(function() {
        $('.description-modal').removeClass('active');
    });

    $('.description-save').click(function() {
        const modal = $('.description-modal');
        const description = modal.find('.description-textarea').val().trim();
        const taskItem = modal.data('currentTask');
        
        if (taskItem) {
            taskItem.data('description', description);
            // Apenas atualizar o botão da tarefa atual, não das subtarefas
            const descriptionBtn = taskItem.find('> .description-btn');
            descriptionBtn.toggleClass('has-description', description !== '');
            saveTasks();
        }
        
        modal.removeClass('active');
    });

    // Adicionar focus handler para a textarea de descrição
    $('.description-textarea').on('focus', function() {
        // Salvar o estado do foco quando a textarea recebe foco
        // Não podemos usar sessionState diretamente pois a textarea não tem ID fixo
        // Mas podemos salvar uma referência ao elemento atual
        const currentTask = $('.description-modal').data('currentTask');
        if (currentTask && currentTask.attr('id')) {
            sessionState.lastDescriptionTaskId = currentTask.attr('id');
            saveSessionState();
        }
    });

    // Fechar modal ao clicar fora
    $('.description-modal').click(function(e) {
        if ($(e.target).hasClass('description-modal')) {
            $(this).removeClass('active');
        }
    });

    // Adicionar listener para o evento de visibilidade da página
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // A extensão está sendo minimizada, salvar o estado
            saveSessionState();
        } else {
            // A extensão está sendo restaurada, carregar o estado
            restoreSessionState();
        }
    });
}); 