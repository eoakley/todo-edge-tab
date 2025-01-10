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
            .addClass('task-item');
            
        if (!isSubtask) {
            li.attr('draggable', false);
        }

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

                    // Disparar confete apenas quando completar (não quando desmarcar)
                    if (isCompleted) {
                        const timeSpent = parseInt(li.data('timeSpent') || 0);
                        showCompletionAnimation(e, timeSpent);
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
                    .addClass('timer-btn play-btn')
                    .html('<i class="fas fa-play"></i>')
                    .click(function() {
                        const btn = $(this);
                        const isPaused = !btn.hasClass('active');
                        btn.toggleClass('active');
                        const pauseBtn = btn.siblings('.pause-btn');
                        pauseBtn.toggleClass('active');
                        
                        if (isPaused) {
                            startTimer(li);
                        } else {
                            pauseTimer(li);
                        }
                    }),
                $('<button>')
                    .addClass('timer-btn pause-btn')
                    .html('<i class="fas fa-pause"></i>')
                    .click(function() {
                        const btn = $(this);
                        const playBtn = btn.siblings('.play-btn');
                        btn.toggleClass('active');
                        playBtn.toggleClass('active');
                        pauseTimer(li);
                    }),
                $('<span>')
                    .addClass('timer-display')
                    .text('00:00:00')
                    .click(function() {
                        const currentDisplay = $(this).text();
                        const input = $('<input>')
                            .attr('type', 'text')
                            .addClass('timer-input')
                            .val(currentDisplay)
                            .blur(function() {
                                const newTime = $(this).val();
                                if (/^\d{2}:\d{2}:\d{2}$/.test(newTime)) {
                                    const [hours, minutes, seconds] = newTime.split(':').map(Number);
                                    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                                    li.data('timeSpent', totalSeconds);
                                    $(this).parent().html(newTime);
                                    saveTasks();
                                } else {
                                    $(this).parent().html(currentDisplay);
                                }
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
                showDeletionAnimation(e);
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
            
            // Criar container de input
            const inputContainer = $('<div>').addClass('input-container');
            const subtaskInput = $('<input>')
                .attr('type', 'text')
                .attr('placeholder', 'Digite uma subtarefa...')
                .addClass('subtask-input')
                .keypress(function(e) {
                    if (e.which == 13) {
                        addSubtask($(this));
                    }
                });
            const addButton = $('<button>')
                .text('Adicionar')
                .click(function() {
                    addSubtask($(this).prev());
                });
            
            inputContainer.append(subtaskInput, addButton);
            
            // Criar lista de subtarefas
            const subtaskList = $('<ul>').addClass('subtask-list');
            
            // Montar a estrutura completa
            subtasksContainer.append(inputContainer, subtaskList);

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
        // Não permitir arrastar se for uma subtarefa
        if ($(this).hasClass('subtask')) {
            e.preventDefault();
            return;
        }
        
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        
        $('.drop-indicator').remove();
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        // Remover o indicador
        $('.drop-indicator').remove();
        draggedItem = null;
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnter(e) {
        if (this !== draggedItem) {
            // Remover qualquer indicador existente
            $('.drop-indicator').remove();
            
            // Criar e inserir novo indicador
            const newIndicator = dropIndicator.clone();
            $(this).before(newIndicator);
            newIndicator.addClass('active');
        }
    }

    function handleDragLeave(e) {
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget || !this.contains(relatedTarget)) {
            // Remover o indicador apenas se o mouse sair completamente do item
            $('.drop-indicator').remove();
        }
    }

    function handleDrop(e) {
        e.stopPropagation();
        e.preventDefault();

        if (draggedItem !== this && !$(this).hasClass('subtask')) {
            this.parentNode.insertBefore(draggedItem, this);
            saveTasks();
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
        }
    }
}); 