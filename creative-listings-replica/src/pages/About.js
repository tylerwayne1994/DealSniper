import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 6rem 2rem 2rem;
`;

const PageHeader = styled.div`
  text-align: center;
  margin-bottom: 4rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 1rem;
`;

const Subtitle = styled.p`
  font-size: 1.1rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
`;

const ContentSection = styled.section`
  background: white;
  padding: 3rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;

  h2 {
    color: #1e293b;
    margin-bottom: 1rem;
    font-size: 1.5rem;
  }

  p {
    color: #374151;
    line-height: 1.7;
    margin-bottom: 1rem;
  }
`;

const TeamGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
`;

const TeamMember = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;

  img {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 1rem;
  }

  h3 {
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .role {
    color: #3b82f6;
    font-weight: 500;
    margin-bottom: 1rem;
  }

  p {
    color: #64748b;
    font-size: 0.9rem;
    line-height: 1.5;
  }
`;

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  margin: 3rem 0;
`;

const StatCard = styled.div`
  text-align: center;
  padding: 2rem;
  background: #f8fafc;
  border-radius: 12px;

  .number {
    font-size: 2.5rem;
    font-weight: 700;
    color: #3b82f6;
    margin-bottom: 0.5rem;
  }

  .label {
    color: #64748b;
    font-weight: 500;
  }
`;

const About = () => {
  return (
    <Container>
      <PageHeader>
        <Title>About eQUITY NEST</Title>
        <Subtitle>
          Your trusted partner in real estate for over 15 years, connecting buyers and sellers 
          with exceptional properties and unparalleled service.
        </Subtitle>
      </PageHeader>

      <ContentSection>
        <h2>Our Story</h2>
        <p>
          Founded in 2010, eQUITY NEST has grown from a small local real estate agency 
          to one of the most trusted names in property services. We believe that buying or 
          selling a property should be an exciting and stress-free experience.
        </p>
        <p>
          Our team of dedicated professionals brings decades of combined experience in real 
          estate, marketing, and customer service. We leverage cutting-edge technology and 
          time-tested strategies to deliver results that exceed our clients' expectations.
        </p>
      </ContentSection>

      <Stats>
        <StatCard>
          <div className="number">1000+</div>
          <div className="label">Properties Sold</div>
        </StatCard>
        <StatCard>
          <div className="number">500+</div>
          <div className="label">Happy Clients</div>
        </StatCard>
        <StatCard>
          <div className="number">15+</div>
          <div className="label">Years Experience</div>
        </StatCard>
        <StatCard>
          <div className="number">98%</div>
          <div className="label">Client Satisfaction</div>
        </StatCard>
      </Stats>

      <ContentSection>
        <h2>Our Mission</h2>
        <p>
          At eQUITY NEST, our mission is to simplify the real estate process while 
          maximizing value for our clients. We are committed to providing personalized 
          service, expert market knowledge, and innovative marketing strategies that get 
          results.
        </p>
        <p>
          We understand that every client's needs are unique, which is why we take the time 
          to listen, understand your goals, and develop a customized approach that works 
          best for your situation.
        </p>
      </ContentSection>

      <ContentSection>
        <h2>Meet Our Team</h2>
        <TeamGrid>
          <TeamMember>
            <img 
              src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200" 
              alt="Sarah Johnson"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/120x120?text=SJ';
              }}
            />
            <h3>Sarah Johnson</h3>
            <div className="role">Founder & CEO</div>
            <p>
              With over 20 years in real estate, Sarah founded eQUITY NEST with 
              a vision to revolutionize the property buying experience.
            </p>
          </TeamMember>

          <TeamMember>
            <img 
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200" 
              alt="Michael Chen"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/120x120?text=MC';
              }}
            />
            <h3>Michael Chen</h3>
            <div className="role">Senior Sales Director</div>
            <p>
              Michael specializes in luxury properties and has helped hundreds of 
              clients find their dream homes in the greater Seattle area.
            </p>
          </TeamMember>

          <TeamMember>
            <img 
              src="https://images.unsplash.com/photo-1494790108755-2616b612b786?w=200" 
              alt="Emily Rodriguez"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/120x120?text=ER';
              }}
            />
            <h3>Emily Rodriguez</h3>
            <div className="role">Marketing Director</div>
            <p>
              Emily leads our marketing efforts, ensuring every property gets maximum 
              exposure through innovative digital marketing strategies.
            </p>
          </TeamMember>
        </TeamGrid>
      </ContentSection>

      <ContentSection>
        <h2>Why Choose Us?</h2>
        <p>
          <strong>Expert Local Knowledge:</strong> Our team knows the local market inside and out, 
          providing you with insights that make a difference.
        </p>
        <p>
          <strong>Cutting-Edge Technology:</strong> We use the latest tools and platforms to market 
          your property effectively and help you find the perfect home.
        </p>
        <p>
          <strong>Personalized Service:</strong> Every client receives dedicated attention and a 
          customized approach tailored to their specific needs and goals.
        </p>
        <p>
          <strong>Proven Results:</strong> Our track record speaks for itself - we consistently 
          deliver exceptional results for our clients.
        </p>
      </ContentSection>
    </Container>
  );
};

export default About;