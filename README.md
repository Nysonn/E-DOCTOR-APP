E-Doctor: Cloud-Based Healthcare Consultation Platform

Overview  
E-Doctor is a cloud-based healthcare consultation platform designed to improve access to healthcare by enabling direct video consultations between patients and doctors. By leveraging cloud technology and the Jitsi video platform, E-Doctor eliminates the need for physical visits and provides a secure, scalable, and convenient solution for remote healthcare.

---

 Features  
1. Service Selection  
   Patients can choose from a variety of medical services, such as dental care, pediatrics, or gynecology.  
   
2. Video Consultation  
   Seamless and secure high-definition video calls facilitated by Jitsi, ensuring smooth and private interactions between patients and doctors.  
   
3. Cloud Integration  
   The platform is hosted on a reliable cloud infrastructure to ensure scalability, performance, and data security.  
   
4. Patient Records  
   Patient consultation history and medical records are securely stored in a PostgreSQL database for easy access and retrieval.  

---

 Target Audience  
- Residents of remote areas where healthcare facilities are scarce.  
- Busy professionals seeking quick and convenient consultations.  
- Healthcare practitioners aiming to expand their services digitally.  

---

 Technology Stack  

 Frontend  
- EJS for dynamic HTML templating.  
- CSS for styling and responsiveness.  
- Vanilla JavaScript for interactive features.  

 Backend  
- Node.js and Express.js for server-side application logic.  

 Database  
- PostgreSQL for storing user profiles, patient records, and consultation history.  

 Communication Layer  
- Jitsi for secure and smooth video conferencing.  

---

 Architecture  

 Frontend  
- Responsive web interface where patients can:  
  - Create accounts and log in.  
  - Select a medical service.  
  - Start video consultations with doctors.  

 Backend  
- Manages authentication, session handling, service selection, and video call routing.  
- Connects the frontend with the database.  

 Database  
- Stores securely encrypted patient data, user profiles, and consultation history.  

---

 Scalability and Performance  
- Autoscaling to handle increased user demand.  
- Load Balancing to optimize resource allocation and improve response times.  
- Performance Monitoring to track consultations per hour, video quality, and system response times.  

---

 Getting Started  

 Prerequisites  
Ensure you have the following installed:  
- Node.js  
- PostgreSQL  
- A modern browser (for Jitsi integration).  

 Installation  

1. Clone the repository:  
   ```bash
   git clone <repository-url>
   cd e-doctor
   ```  

2. Install dependencies:  
   ```bash
   npm install
   ```  

3. Set up the database:  
   - Create a PostgreSQL database.  
   - Update the `.env` file with your database credentials.  

4. Start the server:  
   ```bash
   npm start
   ```  

5. Open the application in your browser:  
   ```text
   http://localhost:3000
   ```

---

 Key Evaluation Metrics  
1. Correctness  
   - Ensures secure storage and retrieval of patient data after consultations.  
   
2. Performance  
   - Handles up to 100 times the expected number of concurrent users and consultations.  

3. User Satisfaction  
   - Feedback gathered post-consultation to improve user experience.  

---

 Future Enhancements  
- Mobile application support for broader accessibility.  
- Multi-language support to serve diverse user groups.  
- AI-based preliminary symptom analysis to assist doctors.  


Developed by Team 3  
Mbarara University of Science and Technology  
Faculty of Computing and Informatics
