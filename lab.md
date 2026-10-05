**> Codebase Exploring & Analysis**
Explore the codebase of ./vllm and help me to onboard to the codebase quickly
Give me easy to understand and concise summary covers the topics of
1. Overall architecture diagram of vllm
2. Major use cases vllm framework supports
3. Overall workflow on how vllm framework is working based on its major use cases, with concise explanation
4. Most critical code files corresponding to those components
5. What are specific areas / items / tradeoffs the current system has that I should pay attention to that could help me to gain more critical and deeper understanding
6. Generate the artifact as .md file for easier followup and iteration


**> Failure Mode Analysis**
Enumerate failure modes:


**> System Gaps & Improvement Plan**
Read through the docs under ./vllm/docs and the codebase, list me the 3 major improvement / new feature opportunities and use easy-to-understand (no analogy) and concise words follow the framing of
1. What problem / gap
2. Why important
3. Current state 
4. How to solve with multiple options and pros and cons  
Each improvement points should be able to be implemented and completed within 3 hours. Also check corresponding codes for each proposed improvement to ensure these are not existing features


**> Implementation Plan**
Hash out the implementation plan first. In the plan, follow this structure:
1. Overall code class / component workflow, and explain the functionality of each class / component concisely
2. Corresponding code files and classes need to be changed and how they should be changed following the workflow (also concisely)
3. List out any tech decisions need to be made with options and pros/cons
4. Testing, verification and benchmark part to demonstrate quick way to show the improvement is working and comparable results of before / after. List out validation arms and metrics
5. Next steps about the post current MVP version, what are other improvements should be added or considered as the next steps
6. Generated artifact as .md file for easier follow-up and iteration


**> Produce Presentation** 
read the doc /Users/xxxxxxx.md and generate the presentation deck content for me, make sure the logic of the slide is fluent, and be focused on the critical parts of the system design. Other requirements are listed below:

1. It should only contain the content for 6-8 slides, no more than that, with separator
2. use concise bullet points with quick explanation for text content
3. Contain main opening and agenda content
4. Include clean diagram with quick workflow description of the diagram when necessary
5. After fully generate the deck content, also generate the corresponding HTML version including the content you generated for the real presentation

