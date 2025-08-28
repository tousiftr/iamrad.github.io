/*!
    * Start Bootstrap - Resume v6.0.1 (https://startbootstrap.com/template-overviews/resume)
    * Copyright 2013-2020 Start Bootstrap
    * Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-resume/blob/master/LICENSE)
    */
   


        // Get the current hour using the Date object
const hour = new Date().getHours();

        // Set the greeting message based on the time of day
let greetingMessage;

        if (hour >= 5 && hour < 12) {
            greetingMessage = "Good Morning!";
        } else if (hour >= 12 && hour < 18) {
            greetingMessage = "Good Arvo!";
        } else {
            greetingMessage = "Good Evening!";
        }

        // Update the HTML element with the greeting message
        document.getElementById("greeting").innerHTML = greetingMessage;
   





    (function ($) {
    "use strict"; // Start of use strict

    // Smooth scrolling using jQuery easing
    $('a.js-scroll-trigger[href*="#"]:not([href="#"])').click(function () {
        if (
            location.pathname.replace(/^\//, "") ==
                this.pathname.replace(/^\//, "") &&
            location.hostname == this.hostname
        ) {
            var target = $(this.hash);
            target = target.length
                ? target
                : $("[name=" + this.hash.slice(1) + "]");
            if (target.length) {
                $("html, body").animate(
                    {
                        scrollTop: target.offset().top,
                    },
                    100,
                    "easeInOutExpo"
                );
                return false;
            }
        }
    });

    // Closes responsive menu when a scroll trigger link is clicked
    $(".js-scroll-trigger").click(function () {
        $(".navbar-collapse").collapse("hide");
    });

     
    $("body").scrollspy({
        target: "#sideNav",
    });
})(jQuery);  


 // Some random colors
const colors = ["#3CC157", "#2AA7FF", "#1B1B1B", "#FCBC0F", "#F85F36"];

const numBalls = 50;
const balls = [];

for (let i = 0; i < numBalls; i++) {
  let ball = document.createElement("div");
  ball.classList.add("ball");
  ball.style.background = colors[Math.floor(Math.random() * colors.length)];
  ball.style.left = `${Math.floor(Math.random() * 100)}vw`;
  ball.style.top = `${Math.floor(Math.random() * 100)}vh`;
  ball.style.transform = `scale(${Math.random()})`;
  ball.style.width = `${Math.random()}em`;
  ball.style.height = ball.style.width;
  
  balls.push(ball);
  document.body.append(ball);
}

// Keyframes
balls.forEach((el, i, ra) => {
  let to = {
    x: Math.random() * (i % 2 === 0 ? -11 : 11),
    y: Math.random() * 12
  };

  let anim = el.animate(
    [
      { transform: "translate(0, 0)" },
      { transform: `translate(${to.x}rem, ${to.y}rem)` }
    ],
    {
      duration: (Math.random() + 1) * 2000, // random duration
      direction: "alternate",
      fill: "both",
      iterations: Infinity,
      easing: "ease-in-out"
    }
  );
});

 

.social-icons {
  margin-top: 15px;
  text-align: center; /* centers on mobile */
}

.social-icons-inner {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
}

.social-icons-inner a {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-size: 20px;
  color: #fff;
  transition: all 0.25s ease;
}

.social-icons-inner a.linkedin { background: #0A66C2; }
.social-icons-inner a.email    { background: #EA4335; }
.social-icons-inner a.phone    { background: #10B981; }
.social-icons-inner a.github   { background: #111827; }

.social-icons-inner a:hover {
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 6px 15px rgba(0,0,0,0.15);
}
