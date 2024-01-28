/* quote */

var myArray = ["Good things come to people who wait, but better things come to those who go out and get them. --Anonymous", "Great minds discuss ideas; average minds discuss events; small minds discuss people. --Eleanor Roosevelt",  "Success is walking from failure to failure with no loss of enthusiasm. --Winston Churchill", "Try not to become a person of success, but rather try to become a person of value. --Albert Einstein", "If you are not willing to risk the usual you will have to settle for the ordinary. --Jim Rohn", "If you want to achieve greatness stop asking for permission. --Anonymous", "Hardships often prepare ordinary people for an extraordinary destiny. - C.S. Lewis", "Learn from yesterday, live for today, hope for tomorrow. The important thing is not to stop questioning. - Albert Einstein", "If you don't value your time, neither will others. Stop giving away your time and talents--start charging for it. --Kim Garst", "If you can't explain it simply, you don't understand it well enough. --Albert Einstein", "Good things come to people who wait, but better things come to those who go out and get them. --Anonymous", "Great minds discuss ideas; average minds discuss events; small minds discuss people. --Eleanor Roosevelt",  "Success is walking from failure to failure with no loss of enthusiasm. --Winston Churchill", "Try not to become a person of success, but rather try to become a person of value. --Albert Einstein", "If you are not willing to risk the usual you will have to settle for the ordinary. --Jim Rohn", "If you want to achieve greatness stop asking for permission. --Anonymous", "Hardships often prepare ordinary people for an extraordinary destiny. - C.S. Lewis", "Learn from yesterday, live for today, hope for tomorrow. The important thing is not to stop questioning. - Albert Einstein", "If you don't value your time, neither will others. Stop giving away your time and talents--start charging for it. --Kim Garst", "If you can't explain it simply, you don't understand it well enough. --Albert Einstein", "Good things come to people who wait, but better things come to those who go out and get them. --Anonymous", "Great minds discuss ideas; average minds discuss events; small minds discuss people. --Eleanor Roosevelt",  "Success is walking from failure to failure with no loss of enthusiasm. --Winston Churchill", "Try not to become a person of success, but rather try to become a person of value. --Albert Einstein", "If you are not willing to risk the usual you will have to settle for the ordinary. --Jim Rohn", "If you want to achieve greatness stop asking for permission. --Anonymous", "Hardships often prepare ordinary people for an extraordinary destiny. - C.S. Lewis", "Learn from yesterday, live for today, hope for tomorrow. The important thing is not to stop questioning. - Albert Einstein", "If you don't value your time, neither will others. Stop giving away your time and talents--start charging for it. --Kim Garst", "If you can't explain it simply, you don't understand it well enough. --Albert Einstein"];

myArray.sort();

var colors = ["#542CE8"];

colors.sort();


var myIndex = 2;
var print = document.getElementById('print');

print.innerHTML = myArray[0]; //Print first value of array right away.


print.style.color = myArray[0]; //Set color of id print.
print.style.color = colors[0];

function nextElement() {
   var randomTopic = myArray[Math.floor(Math.random() * myArray.length)];
    print.innerHTML = randomTopic
   
}