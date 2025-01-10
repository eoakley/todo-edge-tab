document.addEventListener('DOMContentLoaded', function() {
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
        e.preventDefault();
        const pastedText = (e.originalEvent.clipboardData || window.clipboardData).getData('text');
        const tasks = pastedText.split('\n').filter(task => task.trim() !== '');
        
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
            // Criar novo item da lista
            const taskItem = createTaskElement(taskText);
            
            // Adicionar ao topo da lista
            $('#taskList').prepend(taskItem);
            
            // Limpar input e focar novamente
            taskInput.val('').focus();
            
            // Salvar tarefas
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
                .html('<i class="fas fa-plus"></i> Nova subtarefa')
                .click(function() {
                    // Remover placeholder
                    $(this).hide();
                    
                    // Mostrar input container
                    const inputContainer = $('<div>').addClass('input-container');
                    const subtaskInput = $('<input>')
                        .attr('type', 'text')
                        .attr('placeholder', 'Digite uma subtarefa...')
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

            li.append(checkbox, expandBtn, textSpan, timerContainer, deleteBtn, subtasksContainer);
        } else {
            li.append(checkbox, textSpan, deleteBtn);
        }

        return li;
    }

    function addSubtask(input) {
        const subtaskText = input.val().trim();
        if (subtaskText) {
            const subtaskItem = createTaskElement(subtaskText, true);
            input.closest('.subtasks-container').find('.subtask-list').append(subtaskItem);
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
        $('#taskList > li').each(function() {
            const task = {
                text: $(this).find('> .task-text').text(),
                completed: $(this).find('> .task-text').hasClass('completed'),
                timeSpent: $(this).data('timeSpent') || 0,
                subtasks: []
            };

            // Salvar subtarefas
            $(this).find('.subtask-list > li').each(function() {
                task.subtasks.push({
                    text: $(this).find('.task-text').text(),
                    completed: $(this).find('.task-text').hasClass('completed')
                });
            });

            tasks.push(task);
        });
        
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    function loadTasks() {
        const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        tasks.forEach(function(task) {
            const taskItem = createTaskElement(task.text);
            if (task.completed) {
                taskItem.find('> .task-checkbox').prop('checked', true);
                taskItem.find('> .task-text').addClass('completed');
            }
            
            if (task.timeSpent) {
                taskItem.data('timeSpent', task.timeSpent);
                const hours = Math.floor(task.timeSpent / 3600);
                const minutes = Math.floor((task.timeSpent % 3600) / 60);
                const seconds = task.timeSpent % 60;
                const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                taskItem.find('.timer-display').text(display);
            }

            // Carregar subtarefas
            if (task.subtasks && task.subtasks.length > 0) {
                const subtaskList = taskItem.find('.subtask-list');
                task.subtasks.forEach(function(subtask) {
                    const subtaskItem = createTaskElement(subtask.text, true);
                    if (subtask.completed) {
                        subtaskItem.find('.task-checkbox').prop('checked', true);
                        subtaskItem.find('.task-text').addClass('completed');
                    }
                    subtaskList.append(subtaskItem);
                });
            }

            $('#taskList').append(taskItem);
        });
    }

    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        $('html').attr('data-theme', savedTheme);
        if (savedTheme === 'dark') {
            $('#themeToggle i').removeClass('fa-moon').addClass('fa-sun');
        }
    }

    // Função para mostrar a animação de confete
    function showCompletionAnimation(e, timeSpent = 0) {
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

    function startTimer(taskElement) {
        if (taskElement.data('timerInterval')) {
            clearInterval(taskElement.data('timerInterval'));
        }

        const startTime = Date.now() - (taskElement.data('timeSpent') || 0) * 1000;
        taskElement.addClass('timer-active');
        
        const interval = setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            taskElement.data('timeSpent', elapsedSeconds);
            
            const hours = Math.floor(elapsedSeconds / 3600);
            const minutes = Math.floor((elapsedSeconds % 3600) / 60);
            const seconds = elapsedSeconds % 60;
            
            const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            taskElement.find('.timer-display').text(display);
            
            saveTasks();
        }, 1000);

        taskElement.data('timerInterval', interval);
    }

    function pauseTimer(taskElement) {
        const interval = taskElement.data('timerInterval');
        if (interval) {
            clearInterval(interval);
            taskElement.data('timerInterval', null);
            taskElement.removeClass('timer-active');
        }
    }
}); 