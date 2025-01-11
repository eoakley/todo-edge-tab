document.addEventListener('DOMContentLoaded', function() {
    // Configurações padrão
    const defaultSettings = {
        newTaskPosition: 'top',
        newSubtaskPosition: 'bottom',
        theme: 'dark',
        confettiEnabled: true,
        searchBarEnabled: true,
        language: 'pt-BR'
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
        
        // Aplicar visibilidade da barra de pesquisa
        $('.search-container').toggle(settings.searchBarEnabled);
        
        // Atualizar valores no modal de configurações
        $('#newTaskPosition').val(settings.newTaskPosition);
        $('#newSubtaskPosition').val(settings.newSubtaskPosition);
        $('#themeSelect').val(settings.theme);
        $('#confettiEnabled').val(settings.confettiEnabled.toString());
        $('#searchBarEnabled').val(settings.searchBarEnabled.toString());
        $('#language').val(settings.language);

        // Atualizar traduções
        updateTranslations();
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

    $('.settings-cancel').click(function() {
        $('.settings-modal').removeClass('active');
    });

    $('.settings-save').click(function() {
        const newSettings = {
            newTaskPosition: $('#newTaskPosition').val(),
            newSubtaskPosition: $('#newSubtaskPosition').val(),
            theme: $('#themeSelect').val(),
            confettiEnabled: $('#confettiEnabled').val() === 'true',
            searchBarEnabled: $('#searchBarEnabled').val() === 'true',
            language: $('#language').val()
        };
        
        saveSettings(newSettings);
        $('.settings-modal').removeClass('active');
    });

    // Fechar modal ao clicar fora
    $('.settings-modal').click(function(e) {
        if ($(e.target).hasClass('settings-modal')) {
            $(this).removeClass('active');
        }
    });

    // Carregar e exibir uma frase aleatória
    fetch('frases.json')
        .then(response => response.json())
        .then(data => {
            const quotes = data.quotes;
            const randomIndex = Math.floor(Math.random() * quotes.length);
            const quote = quotes[randomIndex];
            
            document.getElementById('quote').textContent = `"${quote.text}"`;
            document.getElementById('author').textContent = `- ${quote.author}`;
        })
        .catch(error => {
            console.error('Erro ao carregar as frases:', error);
            document.getElementById('quote').textContent = 'Faça hoje melhor do que ontem';
            document.getElementById('author').textContent = '- Anônimo';
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

    // Inicializar tema
    initializeTheme();
    
    // Carregar tarefas salvas quando o popup abrir
    loadTasks();

    // Auto-focus no input
    $('#taskInput').focus();

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
        }
    }

    function createTaskElement(taskText, isSubtask = false) {
        const li = $('<li>')
            .addClass('task-item')
            .attr('draggable', true)
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
                textSpan.toggleClass('completed', isCompleted);

                // Se for uma tarefa principal, atualizar todas as subtarefas
                if (!isSubtask) {
                    const subtasks = li.find('.subtask-list .task-checkbox');
                    subtasks.prop('checked', isCompleted);
                    subtasks.each(function() {
                        $(this).closest('.task-item').find('.task-text').toggleClass('completed', isCompleted);
                    });

                    // Pausar o timer se estiver ativo
                    if (isCompleted) {
                        const timerBtn = li.find('.timer-btn.toggle-timer');
                        if (timerBtn.hasClass('active')) {
                            timerBtn.removeClass('active')
                                .html('<i class="fas fa-play"></i>');
                            pauseTimer(li);
                        }
                        showCompletionAnimation(e, parseInt(li.data('timeSpent') || 0));
                    }
                }

                saveTasks();
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
                    });
                $(this).html(input);
                input.focus();
            });

        const timerContainer = $('<div>')
            .addClass('timer-container')
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
                    $(this).toggleClass('expanded');
                    subtasksContainer.toggleClass('expanded');
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
                        .addClass('subtask-input')
                        .keypress(function(e) {
                            if (e.which == 13) {
                                addSubtask($(this));
                                // Manter o input e focar nele
                                $(this).val('').focus();
                            }
                        });
                    const addButton = $('<button>')
                        .text('Adicionar')
                        .click(function() {
                            addSubtask(subtaskInput);
                            // Manter o input e focar nele
                            subtaskInput.val('').focus();
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
                subtasks: []
            };

            // Save subtasks
            $task.find('.subtask-list > .task-item').each(function() {
                const $subtask = $(this);
                taskData.subtasks.push({
                    text: $subtask.find('.task-text').text(),
                    completed: $subtask.find('.task-checkbox').prop('checked'),
                    description: $subtask.data('description') || ''
                });
            });

            tasks.push(taskData);
        });

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

    // Fechar modal ao clicar fora
    $('.description-modal').click(function(e) {
        if ($(e.target).hasClass('description-modal')) {
            $(this).removeClass('active');
        }
    });
}); 